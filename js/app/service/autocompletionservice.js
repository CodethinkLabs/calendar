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

app.service('AutoCompletionService', ['$rootScope', '$http', 'VFreeBusyService',
	function ($rootScope, $http, VFreeBusyService) {
		'use strict';

		this.searchAttendee = function(name, organizer, start, end) {
			return $http.post($rootScope.baseUrl + 'autocompletion/attendee', {
				search: name
			}).then(function (response) {
				if (response.data.length === 0) {
					/* Don't make a freebusy request if there are no matches */
					return response.data;
				}
				return VFreeBusyService.get(organizer,
					response.data, start, end
				).then(function(freebusy) {
					/* Iterate over response.data, inserting busy */
					response.data.forEach(function(attendee) {
						/* An attendee may have multiple E-mail addresses, but is busy if *any* are busy */
						attendee.email.forEach(function(mail) {
							if (!attendee.busy) {
								attendee.busy = freebusy[mail];
							}
						});
					});
					return response.data;
				});
			});
		};

		this.searchLocation = function(address, organizer, start, end) {
			return $http.post($rootScope.baseUrl + 'autocompletion/location', {
				location: address
			}).then(function (response) {
				/* TODO: Use the response data to query for FreeBusy */
				return response.data;
			});
		};
	}
]);
