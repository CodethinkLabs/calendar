<?php
/**
 * Calendar App
 *
 * @author Georg Ehrke
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
namespace OCA\Calendar\Controller;

use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\JSONResponse;
use OCP\Contacts\IManager;
use OCP\IRequest;
use OCP\IUserSession;
use OCP\IGroupManager;
use OCP\Calendar\Room\IManager as RoomManager;
use OCP\Calendar\Resource\IManager as ResourceManager;

class ContactController extends Controller {

	/**
	 * API for contacts api
	 * @var IManager
	 */
	private $contacts;

	private $userSession;

	private $groupManaher;

	/**
	 * @param string $appName
	 * @param IRequest $request an instance of the request
	 * @param IManager $contacts
	 */
	public function __construct($appName, IRequest $request, IManager $contacts,
			IUserSession $userSession, IGroupManager $groupManager,
			RoomManager $roomManager, ResourceManager $resourceManager) {
		parent::__construct($appName, $request);
		$this->contacts = $contacts;
		$this->userSession = $userSession;
		$this->groupManager = $groupManager;
		$this->roomManager = $roomManager;
		$this->resourceManager = $resourceManager;
	}


	/**
	 * @param string $location
	 * @return JSONResponse
	 *
	 * @NoAdminRequired
	 */
	public function searchLocation($location) {
		$result = $this->contacts->search($location, ['FN', 'ADR']);

		$contacts = [];
		foreach ($result as $r) {
			if (!isset($r['ADR'])) {
				continue;
			}

			$name = $this->getNameFromContact($r);
			if (is_string($r['ADR'])) {
				$r['ADR'] = [$r['ADR']];
			}

			foreach ($r['ADR'] as $address) {
				$address = preg_replace("/\n+/", ", ", trim(str_replace(';', "\n", $address)));
				$contacts[] = [
					'label' => $address,
					'name' => $name
				];
			}
		}

		return new JSONResponse($contacts);
	}


	/**
	 * @param string $search
	 * @return JSONResponse
	 *
	 * @NoAdminRequired
	 */
	public function searchAttendee($search) {
		$result = $this->contacts->search($search, ['FN', 'EMAIL']);

		$attendees = [];
		foreach ($result as $r) {
			if (!isset($r['EMAIL'])) {
				continue;
			}

			$name = $this->getNameFromContact($r);
			if (is_string($r['EMAIL'])) {
				$r['EMAIL'] = [$r['EMAIL']];
			}

			$attendees[] = [
					'email' => $r['EMAIL'],
					'name' => $name,
					'type' => 'INDIVIDUAL'
			];
		}
		$user = $this->userSession->getUser();
		$groups = $this->groupManager->getUserGroupIds($user);
		/* Retrieve all rooms */
		$roomBackends = $this->roomManager->getBackends();
		foreach ($roomBackends as $backend) {
			$backend_rooms = $backend->getAllRooms();
			foreach($backend_rooms as $room) {
				/* If "search" matches room E-mail or name */
				$email = $room->getEMail();
				$name = $room->getDisplayName();
				if (strpos($name, $search) === false and strpos($email, $search) === false)
					continue 1;
				/* And, group restrictions has any intersection with user's groups */
				$group_restrict = $room->getGroupRestrictions();
				if ((!empty($group_restrict)) and empty(array_intersect($group_restrict, $groups)))
					continue 1;

				/* Add it to the list of attendees */
				$attendees[] = [
					'email' => [$email],
					'name' => $name,
					'type' => 'ROOM'
				];
			}
		}
		/* Retrieve all resources */
		$resourceBackends = $this->resourceManager->getBackends();
		foreach ($resourceBackends as $backend) {
			$backend_resources = $backend->getAllResources();
			foreach($backend_resources as $resource) {
				$email = $resource->getEMail();
				$name = $resource->getDisplayName();
				/* If "search" matches resource E-mail or name */
				if (strpos($name, $search) === false and strpos($email, $search) === false)
					continue 1;
				/* And, group restrictions has any intersection with user's groups */
				$group_restrict = $resource->getGroupRestrictions();
				if ((!empty($group_restrict)) and empty(array_intersect($group_restrict, $groups)))
					continue 1;

				/* Add it to the list of attendees */
				$attendees[] = [
					'email' => [$email],
					'name' => $name,
					'type' => 'RESOURCE'
				];
			}
		}


		return new JSONResponse($attendees);
	}


	/**
	 * Extract name from an array containing a contact's information
	 *
	 * @param array $r
	 * @return string
	 */
	private function getNameFromContact(array $r) {
		$name = '';
		if (isset($r['FN'])) {
			$name = $r['FN'];
		}

		return $name;
	}
}
