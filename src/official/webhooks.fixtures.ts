/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * webhooks.fixtures.ts: Real webhook deliveries, captured from a live controller and embedded verbatim.
 *
 * The controller document the topology fixtures carry was captured on 2026-08-13 and reported UniFi Access v4.3.3+12030, and every capture in this file comes from
 * that controller. Beyond the v1 in the developer API's path, the payloads carry no schema version of their own, so that application version is what a recapture
 * is compared against.
 */
import type { AccessWebhookEvent } from "./webhooks.ts";

/* Each delivery below is the body of a real webhook request the controller made, embedded exactly as it arrived and declared against the delivery union so the
 * suite type-checks the payload model against real wire material rather than against a restatement of itself. Nothing here is tidied: key order and casing are the
 * controller's own.
 *
 * The set is chosen for what each one settles rather than for coverage. The unlocks are the same event under different circumstances - one performed through the
 * official API with attribution supplied, carrying the actor identity and the caller's own passthrough object, and one performed by a person answering a doorbell call,
 * carrying none of them and naming a human actor instead. Between them they establish which members of an unlock are optional and that the actor really does distinguish
 * an automation from an operator. The ring and the completed call are the two ends of one doorbell lifecycle, joined by the call identifier they share, and the
 * completed one carries the reason code whose documented meaning the wire contradicts. The door-position deliveries are one door opening and closing, which is what
 * shows the status member carries both values rather than one.
 *
 * Captured from a live controller, 2026.
 */
export const accessWebhookDeliveriesFixture: AccessWebhookEvent[] = [

  // Attributed through the official API: the actor identity and the caller's own passthrough object are present.
  {

    "event": "access.door.unlock",
    "event_object_id": "00000000-0000-0000-0000-000000000060",
    "data": {

      "location": {

        "id": "00000000-0000-0000-0000-000000000006",
        "location_type": "door",
        "name": "Test Name 10",
        "up_id": "00000000-0000-0000-0000-000000000001",
        "extras": {

          "door_thumbnail": "REDACTED-0000002c-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
          "door_thumbnail_last_update": 1786826358,
          "uah-input_state_dps": "off",
          "uah-wiring_state_dps-neg": "off",
          "uah-wiring_state_dps-pos": "off"
        },
        "device_ids": null
      },
      "device": {

        "name": "Test Name 76",
        "alias": "",
        "id": "aabbcc000001",
        "ip": "192.0.2.16",
        "mac": "aa:bb:cc:00:00:01",
        "online": false,
        "adopting": false,
        "device_type": "UAH",
        "connected_hub_id": "",
        "location_id": "00000000-0000-0000-0000-000000000006",
        "firmware": "v4.12.19.0",
        "version": "v4.12.195",
        "guid": "00000000-0000-0000-0000-000000000007",
        "start_time": 1786815573,
        "hw_type": "",
        "revision": "1786814328407646934",
        "cap": null,
        "category": null
      },
      "actor": {

        "id": "00000000-0000-0000-0000-000000000061",
        "name": "Test Name 99",
        "type": "open-api"
      },
      "object": {

        "actor_id": "00000000-0000-0000-0000-000000000061",
        "actor_name": "Test Name 99",
        "authentication_type": "REMOTE_THROUGH_UAH",
        "authentication_value": "",
        "extra": {

          "probe": "slice8-webhook"
        },
        "policy_id": "",
        "policy_name": "",
        "reader_id": "",
        "result": "Access Granted",
        "time": "2026-08-15 16:03:48 -0500 CDT"
      }
    }
  },
  // Answered by a person: no attribution is present, and a human actor is named instead.
  {

    "event": "access.door.unlock",
    "event_object_id": "00000000-0000-0000-0000-000000000062",
    "data": {

      "location": {

        "id": "00000000-0000-0000-0000-000000000006",
        "location_type": "door",
        "name": "Test Name 10",
        "up_id": "00000000-0000-0000-0000-000000000001",
        "extras": {

          "door_thumbnail": "REDACTED-0000002d-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
          "door_thumbnail_last_update": 1786828184,
          "uah-input_state_dps": "off",
          "uah-wiring_state_dps-neg": "off",
          "uah-wiring_state_dps-pos": "off"
        },
        "device_ids": null
      },
      "device": {

        "name": "Test Name 76",
        "alias": "",
        "id": "aabbcc000001",
        "ip": "192.0.2.16",
        "mac": "aa:bb:cc:00:00:01",
        "online": false,
        "adopting": false,
        "device_type": "UAH",
        "connected_hub_id": "",
        "location_id": "00000000-0000-0000-0000-000000000006",
        "firmware": "v4.12.19.0",
        "version": "v4.12.195",
        "guid": "00000000-0000-0000-0000-000000000007",
        "start_time": 1786815573,
        "hw_type": "",
        "revision": "1786814328407646934",
        "cap": null,
        "category": null
      },
      "actor": {

        "id": "00000000-0000-0000-0000-00000000000b",
        "name": "Test Name 69",
        "type": "user"
      },
      "object": {

        "authentication_type": "CALL",
        "authentication_value": "",
        "policy_id": "",
        "policy_name": "",
        "reader_id": "aabbcc000002",
        "result": "Access Granted",
        "time": "2026-08-15 16:09:58 -0500 CDT"
      }
    }
  },
  // The ring that starts the doorbell lifecycle.
  {

    "event": "access.doorbell.incoming",
    "event_object_id": "00000000-0000-0000-0000-000000000063",
    "data": {

      "location": {

        "id": "00000000-0000-0000-0000-000000000006",
        "location_type": "door",
        "name": "Test Name 10",
        "up_id": "00000000-0000-0000-0000-000000000001",
        "extras": {

          "door_thumbnail": "REDACTED-0000002e-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
          "door_thumbnail_last_update": 1786827890,
          "uah-input_state_dps": "off",
          "uah-wiring_state_dps-neg": "off",
          "uah-wiring_state_dps-pos": "off"
        },
        "device_ids": null
      },
      "device": {

        "name": "Test Name 68",
        "alias": "",
        "id": "aabbcc000002",
        "ip": "192.0.2.3",
        "mac": "aa:bb:cc:00:00:02",
        "online": false,
        "adopting": false,
        "device_type": "UA-G2-PRO",
        "connected_hub_id": "aabbcc000001",
        "location_id": "00000000-0000-0000-0000-000000000006",
        "firmware": "v1.14.17.0",
        "version": "v3.14.4552",
        "guid": "00000000-0000-0000-0000-000000000009",
        "start_time": 1786815545,
        "hw_type": "GA",
        "revision": "1786814328407646934",
        "cap": null,
        "category": null
      },
      "actor": null,
      "object": {

        "request_id": "4laAz56oPVVqSpb2VFlxLD5eY7ALktUn"
      }
    }
  },
  // The same call's completion, carrying the reason code whose documented meaning the wire contradicts.
  {

    "event": "access.doorbell.completed",
    "event_object_id": "00000000-0000-0000-0000-000000000064",
    "data": {

      "location": {

        "id": "00000000-0000-0000-0000-000000000006",
        "location_type": "door",
        "name": "Test Name 10",
        "up_id": "00000000-0000-0000-0000-000000000001",
        "extras": {

          "door_thumbnail": "REDACTED-0000002d-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
          "door_thumbnail_last_update": 1786828184,
          "uah-input_state_dps": "off",
          "uah-wiring_state_dps-neg": "off",
          "uah-wiring_state_dps-pos": "off"
        },
        "device_ids": null
      },
      "device": {

        "name": "Test Name 68",
        "alias": "",
        "id": "aabbcc000002",
        "ip": "192.0.2.3",
        "mac": "aa:bb:cc:00:00:02",
        "online": false,
        "adopting": false,
        "device_type": "UA-G2-PRO",
        "connected_hub_id": "aabbcc000001",
        "location_id": "00000000-0000-0000-0000-000000000006",
        "firmware": "v1.14.17.0",
        "version": "v3.14.4552",
        "guid": "00000000-0000-0000-0000-000000000009",
        "start_time": 1786815545,
        "hw_type": "GA",
        "revision": "1786814328407646934",
        "cap": null,
        "category": null
      },
      "actor": null,
      "object": {

        "host_device_mac": "",
        "reason_code": 400,
        "request_id": "4laAz56oPVVqSpb2VFlxLD5eY7ALktUn"
      }
    }
  },
  // One door-position direction: closing.
  {

    "event": "access.device.dps_status",
    "event_object_id": "00000000-0000-0000-0000-000000000065",
    "data": {

      "location": {

        "id": "00000000-0000-0000-0000-00000000000e",
        "location_type": "door",
        "name": "Test Name 22",
        "up_id": "00000000-0000-0000-0000-000000000001",
        "extras": {},
        "device_ids": null
      },
      "device": {

        "name": "Test Name 24",
        "alias": "",
        "id": "aabbcc000004",
        "ip": "192.0.2.17",
        "mac": "aa:bb:cc:00:00:04",
        "online": false,
        "adopting": false,
        "device_type": "UA-Hub-Door-Mini",
        "connected_hub_id": "",
        "location_id": "00000000-0000-0000-0000-00000000000e",
        "firmware": "v1.5.16.0",
        "version": "",
        "guid": "00000000-0000-0000-0000-00000000000f",
        "start_time": 1786815547,
        "hw_type": "GA",
        "revision": "1786814328407646934",
        "cap": null,
        "category": null
      },
      "actor": null,
      "object": {

        "event_type": "dps_change",
        "status": "close"
      }
    }
  },
  // The other door-position direction: opening.
  {

    "event": "access.device.dps_status",
    "event_object_id": "00000000-0000-0000-0000-000000000066",
    "data": {

      "location": {

        "id": "00000000-0000-0000-0000-00000000000e",
        "location_type": "door",
        "name": "Test Name 22",
        "up_id": "00000000-0000-0000-0000-000000000001",
        "extras": {},
        "device_ids": null
      },
      "device": {

        "name": "Test Name 24",
        "alias": "",
        "id": "aabbcc000004",
        "ip": "192.0.2.17",
        "mac": "aa:bb:cc:00:00:04",
        "online": false,
        "adopting": false,
        "device_type": "UA-Hub-Door-Mini",
        "connected_hub_id": "",
        "location_id": "00000000-0000-0000-0000-00000000000e",
        "firmware": "v1.5.16.0",
        "version": "",
        "guid": "00000000-0000-0000-0000-00000000000f",
        "start_time": 1786815547,
        "hw_type": "GA",
        "revision": "1786814328407646934",
        "cap": null,
        "category": null
      },
      "actor": null,
      "object": {

        "event_type": "dps_change",
        "status": "open"
      }
    }
  }
];
