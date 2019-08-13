/**
 * Calendar App
 *
 * @author Raghu Nayyar
 * @author Georg Ehrke
 * @copyright 2016 Raghu Nayyar <hey@raghunayyar.com>
 * @copyright 2016 Georg Ehrke <oc.list@georgehrke.com>
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU AFFERO GENERAL PUBLIC LICENSE
 * License as published by the Free Software Foundation; either
 * version 3 of the License, or any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU AFFERO GENERAL PUBLIC LICENSE for more details.
 *
 * You should have received a copy of the GNU Affero General Public
 * License along with this library.  If not, see <http://www.gnu.org/licenses/>.
 *
 */

app.service('VFreeBusyService', function(DavClient, StringUtility) {
	'use strict';

	const context = {
		self: this,
		userPrincipal: null,
		calendarHome: null,
		outboxUrl: null,
		vfreebusySkeleton: [
			"BEGIN:VCALENDAR",
			"VERSION:2.0",
			"PRODID:Nextcloud Calendar",
			"METHOD:REQUEST",
			"BEGIN:VFREEBUSY",
			"END:VFREEBUSY",
			"END:VCALENDAR"
		].join("\r\n")
	};

	context.bootPromise = (function() {
		const url = DavClient.buildUrl(OC.linkToRemoteBase('dav'));
		const headers = {
			'requesttoken': OC.requestToken
		};
		const depth = 0;
		const properties = [
			'{' + DavClient.NS_DAV + '}current-user-principal'
		];
		return DavClient.propFind(url, properties, depth, headers).then(function(response) {
			if (!DavClient.wasRequestSuccessful(response.status) || response.body.propStat.length < 1) {
				throw new Error('current-user-principal could not be determined');
			}

			const props = response.body.propStat[0].properties;
			context.userPrincipal = props['{' + DavClient.NS_DAV + '}current-user-principal'][0].textContent;


			const url = context.userPrincipal;
			const headers = {
				'requesttoken': OC.requestToken
			};
			const properties = [
				'{' + DavClient.NS_IETF + '}calendar-home-set',
			];
			const depth = 0;
			return DavClient.propFind(url, properties, depth, headers).then(function(response) {
				if (!DavClient.wasRequestSuccessful(response.status) || response.body.propStat.length < 1) {
					throw new Error('calendar-home-set could not be retrieved');
				}
				const props = response.body.propStat[0].properties;
				context.calendarHome = props['{' + DavClient.NS_IETF + '}calendar-home-set'][0].textContent;
				/* Nextcloud doesn't seem to publish schedule-outbox-url, but we know it exists so just construct it */
				context.outboxUrl = context.calendarHome + "outbox/";
			});
		});
	}());

	/**
	 * get whether a list of attendees are free/busy in a given time interval
	 * @param {object} organizer
	 * @param {array} attendees
	 * @param {moment} start
	 * @param {moment} end
	 * @returns {Promise}
	 */
	this.get = function(organizer, attendees, start, end) {
		return context.bootPromise.then(function() {

			const headers = {
				'requesttoken': OC.requestToken,
				'Content-Type': 'text/calendar; charset="utf-8"'
			};
			const url = DavClient.buildUrl(context.outboxUrl);
			/* organizer is actually an object, with .parameters.cn (a name) and .value (an email)
			 * attendees is actually a list of objects, with .name (a name) and .email (an email)
			 * start and end are objects with .parameters.zone (a string indicating timezone) and .value, a moment (see momentjs.com)
			 */

			/* Construct a query */
			var vcalendar = ICAL.Component.fromString(context.vfreebusySkeleton);
			var vfreebusy = vcalendar.getFirstSubcomponent();
			var organizerProp = vfreebusy.addPropertyWithValue("ORGANIZER", organizer.value);
			organizerProp.setParameter("cn", organizer.parameters.cn);
			attendees.forEach(function (attendee) {
				var attendeeProp = vfreebusy.addPropertyWithValue("ATTENDEE", attendee.email[0]);
				attendeeProp.setParameter("cn", attendee.name);
			});
			vfreebusy.addPropertyWithValue("DTSTAMP", StringUtility.getTimeRangeString(moment())); /* now */
			vfreebusy.addPropertyWithValue("DTSTART", StringUtility.getTimeRangeString(start.value));
			vfreebusy.addPropertyWithValue("DTEND", StringUtility.getTimeRangeString(end.value));
			vfreebusy.addPropertyWithValue("UID", StringUtility.uid());
			/* Dispatch the query */
			return DavClient.request("POST", url, headers, vcalendar.toString()).then(function(response) {
				/* Parse the response and return which E-mail addresses are busy */
				var parser = new DOMParser();
				var doc = parser.parseFromString(response.body, "application/xml");
				var elements = doc.getElementsByTagName("cal:calendar-data");
				var freebusy = {};
				/* getElementsByTagName doesn't always return something with forEach */
				Array.prototype.forEach.call(elements, function(element) {
					var vc = ICAL.Component.fromString(element.innerHTML);
					var vf = vc.getFirstSubcomponent();
					var attendee = vf.getFirstPropertyValue("attendee");
					var mail = attendee.slice(7); // strip the "mailto:"
					if (vf.hasProperty("freebusy")) {
						freebusy[mail] = true;
					} else {
						freebusy[mail] = false;
					}
				});
				return freebusy;
			});
		});
	};
});
