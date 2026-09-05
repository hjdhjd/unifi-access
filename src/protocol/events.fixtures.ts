/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * events.fixtures.ts: Real UniFi Access notification packets, captured from live controllers and embedded verbatim.
 */
import type { AccessEventPacket } from "../types/index.ts";

/* Each group below holds real notification packets, embedded exactly as the controller sent them and declared against the envelope type so the suite type-checks the
 * type model against real wire material. Nothing here is tidied: key order, casing, and the nineteen-digit revision strings are the controller's own.
 */

/* The 2026 corpus: one continuous capture window from a controller running both notification dialects. It carries all eight event names the window produced,
 * including the paired legacy and v2 emissions for the same physical change and a v2-only burst with no legacy twin.
 *
 * Captured from a live controller, 2026.
 */
export const accessEventPacketsFixture: AccessEventPacket[] = [

  {

    "event": "access.base.info",
    "receiver_id": "",
    "event_object_id": "00000000-0000-0000-0000-000000000033",
    "save_to_history": false,
    "data": {

      "top_log_count": 0
    }
  },
  {

    "event": "access.data.camera.update",
    "receiver_id": "",
    "event_object_id": "00000000000000000000000c",
    "save_to_history": false,
    "data": {

      "mac": "AABBCC000010",
      "ip": "192.0.2.13",
      "name": "Test Name 65",
      "status": "online",
      "firmwareStatus": "upToDate",
      "firmware": "5.3.95",
      "startupTime": 1782282073038,
      "model": "G6 Pro Entry",
      "shortname": "Test shortname 66",
      "isManaged": true,
      "isAdopted": true,
      "isConnected": true,
      "metadata": {

        "deviceType": "camera",
        "uniqueId": "00000000000000000000000c"
      },
      "guid": "00000000-0000-0000-0000-000000000034",
      "images": {

        "xs": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_25x25.png",
        "s": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_32x32.png",
        "m": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_51x51.png",
        "l": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_64x64.png",
        "xl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_101x101.png",
        "xxl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_128x128.png",
        "animation": [
          "icons/g6-pro-entry-close.png",
          "icons/g6-pro-entry-open.png"
        ]
      },
      "source": "protect",
      "uniqueId": "00000000000000000000000c",
      "type": "UVC G6 Pro Entry",
      "supportLicensePlate": true,
      "supportDetectLPOnly": true,
      "videoWidth": 3024,
      "videoHeight": 4096,
      "videoCodec": "h265",
      "lastSeen": 1786606325038,
      "hubMac": "",
      "smartDetectZones": [
        {

          "id": 10001,
          "name": "Test Name 17",
          "color": "#AB46BC",
          "points": [
            [
              0,
              0
            ],
            [
              1,
              0
            ],
            [
              1,
              1
            ],
            [
              0,
              1
            ]
          ],
          "sensitivity": 50,
          "objectTypes": [
            "person",
            "vehicle",
            "animal",
            "face",
            "licensePlate"
          ],
          "isTriggerLightEnabled": true,
          "triggerAccessTypes": [],
          "source": "unifi-access",
          "enableAccessLPOnlyMode": false
        }
      ],
      "allSmartDetectZones": [
        {

          "id": 1,
          "name": "Test Name 67",
          "color": "#AB46BC",
          "points": [
            [
              0,
              0
            ],
            [
              1,
              0
            ],
            [
              1,
              1
            ],
            [
              0,
              1
            ]
          ],
          "sensitivity": 50,
          "objectTypes": [
            "person",
            "vehicle",
            "animal",
            "face"
          ],
          "isTriggerLightEnabled": true,
          "triggerAccessTypes": [],
          "source": "unifi-protect",
          "enableAccessLPOnlyMode": false
        }
      ],
      "smartDetectSettings": {

        "objectTypes": [
          "person",
          "vehicle",
          "animal",
          "package",
          "face",
          "licensePlate"
        ],
        "autoTrackingObjectTypes": [],
        "autoTrackingWithZoom": true,
        "audioTypes": [
          "alrmSmoke",
          "alrmCmonx",
          "alrmSiren",
          "alrmBabyCry",
          "alrmSpeak",
          "alrmBurglar",
          "alrmCarHorn",
          "alrmBark",
          "alrmGlassBreak"
        ],
        "enableTamperDetection": false,
        "detectionRange": {

          "max": 0,
          "min": 0
        }
      },
      "supportDoorAccessConfig": true,
      "recordingSettings": {

        "mode": "always",
        "prePaddingSecs": 2,
        "postPaddingSecs": 2,
        "smartDetectPrePaddingSecs": 2,
        "smartDetectPostPaddingSecs": 2,
        "minMotionEventTrigger": 1000,
        "endMotionEventDelay": 3000,
        "suppressIlluminationSurge": false,
        "inScheduleMode": "always",
        "outScheduleMode": "never",
        "geofencing": "off",
        "motionAlgorithm": "enhanced",
        "enableMotionDetection": false,
        "createAccessEvent": true,
        "useNewMotionAlgorithm": true
      },
      "osdSettings": {

        "isNameEnabled": false,
        "isDateEnabled": true,
        "isLogoEnabled": false,
        "isDebugEnabled": false
      },
      "micVolume": 100,
      "isMicEnabled": true,
      "talkbackSettings": {

        "bindAddr": "192.0.2.14",
        "bindPort": 7004,
        "bitsPerSample": 16,
        "channels": 1,
        "filterAddr": "",
        "filterPort": 0,
        "quality": 100,
        "samplingRate": 22050,
        "typeFmt": "aac",
        "typeIn": "serverudp"
      },
      "hasSpeaker": true,
      "isWaterproofCaseAttached": false,
      "ispSettings": {

        "aeMode": "auto",
        "irLedMode": "auto",
        "irLedLevel": 255,
        "wdr": 1,
        "icrSensitivity": 0,
        "icrSwitchMode": "sensitivity",
        "icrCustomValue": 1,
        "brightness": 50,
        "contrast": 50,
        "hue": 50,
        "saturation": 50,
        "sharpness": 50,
        "denoise": 50,
        "isColorNightVisionEnabled": true,
        "spotlightDuration": 15,
        "isFlippedVertical": false,
        "isFlippedHorizontal": false,
        "isAutoRotateEnabled": false,
        "isLdcEnabled": true,
        "is3dnrEnabled": true,
        "isExternalIrEnabled": false,
        "isAggressiveAntiFlickerEnabled": false,
        "isPauseMotionEnabled": false,
        "dZoomCenterX": 50,
        "dZoomCenterY": 50,
        "dZoomScale": 0,
        "dZoomStreamId": 4,
        "focusPosition": 0,
        "touchFocusX": 1001,
        "touchFocusY": 1001,
        "zoomPosition": 0,
        "mountPosition": "ceiling",
        "hdrMode": "normal",
        "sceneMode": "auto",
        "isSmokeCoverModeEnabled": false
      },
      "isPoorNetwork": false,
      "featureFlags": {

        "smartDetectTypes": [
          "person",
          "vehicle",
          "animal",
          "package",
          "face",
          "licensePlate"
        ],
        "supportDoorAccessConfig": true,
        "supportNfc": false,
        "supportLpOnly": false,
        "supportLpDetectionWithoutVehicle": true,
        "hasMic": true,
        "hasPackageCamera": true,
        "hasPackageZoneSupportForSecondaryLens": true,
        "canOpticalZoom": false,
        "hotPlug": {

          "audio": null
        },
        "reader": {

          "supportAccessMethods": [
            "nfc",
            "touchPass",
            "pinCode",
            "btButton",
            "btTap",
            "face",
            "qrCode"
          ],
          "support2fa": false,
          "supportLocate": true,
          "supportDoorDirection": true,
          "supportCallerManager": true,
          "supportInterfaceDirectory": true,
          "supportGreetings": true,
          "supportShowInterfaceImage": true,
          "supportShowStatusBar": true,
          "supportShowHeading": true,
          "supportGateStop": true
        }
      },
      "currentResolution": "5K",
      "supportNfc": true,
      "supportTouchPass": true,
      "supportFaceUnlock": true,
      "supportBtButton": true,
      "supportBtTap": true,
      "supportQrCode": true,
      "supportPIN": true,
      "supportTwoStepAuth": false,
      "supportGreeting": true,
      "supportDirection": false,
      "supportCallerManager": true,
      "supportMobileUnlockV2": true,
      "supportCallerDirectory": true,
      "supportTwilioSip": false,
      "supportGateStop": true,
      "supportShowInterfaceImage": true,
      "supportShowStatusBar": true,
      "supportShowHeading": true,
      "isFloodlightTriggerEnabled": false,
      "stats": {

        "video": {

          "recordingStart": 1784220871786,
          "recordingEnd": 1786606333340,
          "recordingStartLQ": 1784210492601,
          "recordingEndLQ": 1786606333346
        }
      },
      "location": [],
      "configs": [
        {

          "device_id": "00000000000000000000000c",
          "key": "capture_enable",
          "value": "yes",
          "tag": "device_extra",
          "update_time": "0001-01-01T00:00:00Z",
          "create_time": "0001-01-01T00:00:00Z"
        },
        {

          "device_id": "00000000000000000000000c",
          "key": "capture",
          "value": "yes",
          "tag": "device_extra",
          "update_time": "0001-01-01T00:00:00Z",
          "create_time": "0001-01-01T00:00:00Z"
        },
        {

          "device_id": "00000000000000000000000c",
          "key": "door_entry_method",
          "value": "in",
          "tag": "door_entry_method",
          "update_time": "0001-01-01T00:00:00Z",
          "create_time": "0001-01-01T00:00:00Z"
        }
      ],
      "support_feature": [
        "capture"
      ],
      "bind_same_paired": false,
      "accessDetectZones": [],
      "isAccessReader": false
    }
  },
  {

    "event": "access.data.device.update",
    "receiver_id": "",
    "event_object_id": "00000000000000000000000c",
    "save_to_history": false,
    "data": {

      "unique_id": "00000000000000000000000c",
      "name": "Test Name 65",
      "alias": "",
      "device_type": "UVC G6 Pro Entry",
      "connected_uah_id": "",
      "location_id": "",
      "firmware": "5.3.95",
      "version": "5.3.95",
      "ip": "192.0.2.13",
      "mac": "aa:bb:cc:00:00:10",
      "hw_type": "",
      "start_time": 1782282073,
      "last_seen": null,
      "security_check": null,
      "source": null,
      "bom_rev": null,
      "guid": "00000000-0000-0000-0000-000000000034",
      "need_advisory": null,
      "is_camera": true,
      "resource_name": "",
      "revision": null,
      "revision_update_time": null,
      "version_update_time": null,
      "firmware_update_time": null,
      "adopt_time": null,
      "location": null,
      "configs": [
        {

          "device_id": "00000000000000000000000d",
          "key": "capture_enable",
          "value": "yes",
          "tag": "device_extra",
          "update_time": "0001-01-01T00:00:00Z",
          "create_time": "0001-01-01T00:00:00Z"
        },
        {

          "device_id": "00000000000000000000000d",
          "key": "capture",
          "value": "yes",
          "tag": "device_extra",
          "update_time": "0001-01-01T00:00:00Z",
          "create_time": "0001-01-01T00:00:00Z"
        },
        {

          "device_id": "00000000000000000000000d",
          "key": "door_entry_method",
          "value": "in",
          "tag": "door_entry_method",
          "update_time": "0001-01-01T00:00:00Z",
          "create_time": "0001-01-01T00:00:00Z"
        }
      ],
      "is_connected": true,
      "is_online": true,
      "is_revision_up_to_date": false,
      "is_adopted": true,
      "is_managed": true,
      "is_upgrade_blocked": false,
      "is_export_sf_blocked": false,
      "is_rebooting": false,
      "update": null,
      "capabilities": [
        "support_register_card",
        "nfc_card_easy_provision",
        "support_mobile_unlock",
        "support_apple_pass",
        "show_face_method",
        "support_inhouse_sdk",
        "anti_spoofing_level",
        "support_face_sensitivity",
        "pin_code",
        "qr_code",
        "support_greeting",
        "support_caller_manager",
        "support_directory_direct",
        "support_show_interface_image",
        "support_show_status_bar",
        "support_show_heading",
        "identity_unlock_control_cmd",
        "support_ems",
        "doorbell_timeout",
        "doorbell_bind",
        "identity_support_ems",
        "identity_remote_view",
        "identity_face_unlock",
        "identity_is_camera",
        "support_record_hq_stream",
        "keypad_layout"
      ],
      "template": null,
      "images": {

        "xs": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_25x25.png",
        "s": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_32x32.png",
        "m": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_51x51.png",
        "l": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_64x64.png",
        "xl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_101x101.png",
        "xxl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_128x128.png",
        "animation": [
          "icons/g6-pro-entry-close.png",
          "icons/g6-pro-entry-open.png"
        ]
      },
      "camera_resource": {

        "mac": "AABBCC000010",
        "ip": "192.0.2.13",
        "name": "Test Name 65",
        "status": "online",
        "firmwareStatus": "upToDate",
        "firmware": "5.3.95",
        "startupTime": 1782282073038,
        "model": "G6 Pro Entry",
        "shortname": "Test shortname 66",
        "isManaged": true,
        "isAdopted": true,
        "isConnected": true,
        "metadata": {

          "deviceType": "camera",
          "uniqueId": "00000000000000000000000c"
        },
        "guid": "00000000-0000-0000-0000-000000000034",
        "images": {

          "xs": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_25x25.png",
          "s": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_32x32.png",
          "m": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_51x51.png",
          "l": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_64x64.png",
          "xl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_101x101.png",
          "xxl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_128x128.png",
          "animation": [
            "icons/g6-pro-entry-close.png",
            "icons/g6-pro-entry-open.png"
          ]
        },
        "source": "protect",
        "uniqueId": "00000000000000000000000c",
        "type": "UVC G6 Pro Entry",
        "supportLicensePlate": true,
        "supportDetectLPOnly": true,
        "videoWidth": 3024,
        "videoHeight": 4096,
        "videoCodec": "h265",
        "lastSeen": 1786606325038,
        "hubMac": "",
        "smartDetectZones": [
          {

            "id": 10001,
            "name": "Test Name 17",
            "color": "#AB46BC",
            "points": [
              [
                0,
                0
              ],
              [
                1,
                0
              ],
              [
                1,
                1
              ],
              [
                0,
                1
              ]
            ],
            "sensitivity": 50,
            "objectTypes": [
              "person",
              "vehicle",
              "animal",
              "face",
              "licensePlate"
            ],
            "isTriggerLightEnabled": true,
            "triggerAccessTypes": [],
            "source": "unifi-access",
            "enableAccessLPOnlyMode": false
          }
        ],
        "allSmartDetectZones": [
          {

            "id": 1,
            "name": "Test Name 67",
            "color": "#AB46BC",
            "points": [
              [
                0,
                0
              ],
              [
                1,
                0
              ],
              [
                1,
                1
              ],
              [
                0,
                1
              ]
            ],
            "sensitivity": 50,
            "objectTypes": [
              "person",
              "vehicle",
              "animal",
              "face"
            ],
            "isTriggerLightEnabled": true,
            "triggerAccessTypes": [],
            "source": "unifi-protect",
            "enableAccessLPOnlyMode": false
          }
        ],
        "smartDetectSettings": {

          "objectTypes": [
            "person",
            "vehicle",
            "animal",
            "package",
            "face",
            "licensePlate"
          ],
          "autoTrackingObjectTypes": [],
          "autoTrackingWithZoom": true,
          "audioTypes": [
            "alrmSmoke",
            "alrmCmonx",
            "alrmSiren",
            "alrmBabyCry",
            "alrmSpeak",
            "alrmBurglar",
            "alrmCarHorn",
            "alrmBark",
            "alrmGlassBreak"
          ],
          "enableTamperDetection": false,
          "detectionRange": {

            "max": 0,
            "min": 0
          }
        },
        "supportDoorAccessConfig": true,
        "recordingSettings": {

          "mode": "always",
          "prePaddingSecs": 2,
          "postPaddingSecs": 2,
          "smartDetectPrePaddingSecs": 2,
          "smartDetectPostPaddingSecs": 2,
          "minMotionEventTrigger": 1000,
          "endMotionEventDelay": 3000,
          "suppressIlluminationSurge": false,
          "inScheduleMode": "always",
          "outScheduleMode": "never",
          "geofencing": "off",
          "motionAlgorithm": "enhanced",
          "enableMotionDetection": false,
          "createAccessEvent": true,
          "useNewMotionAlgorithm": true
        },
        "osdSettings": {

          "isNameEnabled": false,
          "isDateEnabled": true,
          "isLogoEnabled": false,
          "isDebugEnabled": false
        },
        "micVolume": 100,
        "isMicEnabled": true,
        "talkbackSettings": {

          "bindAddr": "192.0.2.14",
          "bindPort": 7004,
          "bitsPerSample": 16,
          "channels": 1,
          "filterAddr": "",
          "filterPort": 0,
          "quality": 100,
          "samplingRate": 22050,
          "typeFmt": "aac",
          "typeIn": "serverudp"
        },
        "hasSpeaker": true,
        "isWaterproofCaseAttached": false,
        "ispSettings": {

          "aeMode": "auto",
          "irLedMode": "auto",
          "irLedLevel": 255,
          "wdr": 1,
          "icrSensitivity": 0,
          "icrSwitchMode": "sensitivity",
          "icrCustomValue": 1,
          "brightness": 50,
          "contrast": 50,
          "hue": 50,
          "saturation": 50,
          "sharpness": 50,
          "denoise": 50,
          "isColorNightVisionEnabled": true,
          "spotlightDuration": 15,
          "isFlippedVertical": false,
          "isFlippedHorizontal": false,
          "isAutoRotateEnabled": false,
          "isLdcEnabled": true,
          "is3dnrEnabled": true,
          "isExternalIrEnabled": false,
          "isAggressiveAntiFlickerEnabled": false,
          "isPauseMotionEnabled": false,
          "dZoomCenterX": 50,
          "dZoomCenterY": 50,
          "dZoomScale": 0,
          "dZoomStreamId": 4,
          "focusPosition": 0,
          "touchFocusX": 1001,
          "touchFocusY": 1001,
          "zoomPosition": 0,
          "mountPosition": "ceiling",
          "hdrMode": "normal",
          "sceneMode": "auto",
          "isSmokeCoverModeEnabled": false
        },
        "isPoorNetwork": false,
        "featureFlags": {

          "smartDetectTypes": [
            "person",
            "vehicle",
            "animal",
            "package",
            "face",
            "licensePlate"
          ],
          "supportDoorAccessConfig": true,
          "supportNfc": false,
          "supportLpOnly": false,
          "supportLpDetectionWithoutVehicle": true,
          "hasMic": true,
          "hasPackageCamera": true,
          "hasPackageZoneSupportForSecondaryLens": true,
          "canOpticalZoom": false,
          "hotPlug": {

            "audio": null
          },
          "reader": {

            "supportAccessMethods": [
              "nfc",
              "touchPass",
              "pinCode",
              "btButton",
              "btTap",
              "face",
              "qrCode"
            ],
            "support2fa": false,
            "supportLocate": true,
            "supportDoorDirection": true,
            "supportCallerManager": true,
            "supportInterfaceDirectory": true,
            "supportGreetings": true,
            "supportShowInterfaceImage": true,
            "supportShowStatusBar": true,
            "supportShowHeading": true,
            "supportGateStop": true
          }
        },
        "currentResolution": "5K",
        "supportNfc": true,
        "supportTouchPass": true,
        "supportFaceUnlock": true,
        "supportBtButton": true,
        "supportBtTap": true,
        "supportQrCode": true,
        "supportPIN": true,
        "supportTwoStepAuth": false,
        "supportGreeting": true,
        "supportDirection": false,
        "supportCallerManager": true,
        "supportMobileUnlockV2": true,
        "supportCallerDirectory": true,
        "supportTwilioSip": false,
        "supportGateStop": true,
        "supportShowInterfaceImage": true,
        "supportShowStatusBar": true,
        "supportShowHeading": true,
        "isFloodlightTriggerEnabled": false,
        "stats": {

          "video": {

            "recordingStart": 1784220871786,
            "recordingEnd": 1786606333340,
            "recordingStartLQ": 1784210492601,
            "recordingEndLQ": 1786606333346
          }
        },
        "location": [],
        "configs": [
          {

            "device_id": "00000000000000000000000d",
            "key": "capture_enable",
            "value": "yes",
            "tag": "device_extra",
            "update_time": "0001-01-01T00:00:00Z",
            "create_time": "0001-01-01T00:00:00Z"
          },
          {

            "device_id": "00000000000000000000000d",
            "key": "capture",
            "value": "yes",
            "tag": "device_extra",
            "update_time": "0001-01-01T00:00:00Z",
            "create_time": "0001-01-01T00:00:00Z"
          },
          {

            "device_id": "00000000000000000000000d",
            "key": "door_entry_method",
            "value": "in",
            "tag": "door_entry_method",
            "update_time": "0001-01-01T00:00:00Z",
            "create_time": "0001-01-01T00:00:00Z"
          }
        ],
        "support_feature": [
          "capture"
        ],
        "bind_same_paired": false,
        "accessDetectZones": [],
        "isAccessReader": false
      }
    }
  },
  {

    "event": "access.data.v2.device.update",
    "receiver_id": "",
    "event_object_id": "00000000-0000-0000-0000-000000000035",
    "save_to_history": false,
    "data": {

      "name": "Test Name 65",
      "alias": "",
      "id": "00000000000000000000000c",
      "ip": "192.0.2.13",
      "mac": "AABBCC000010",
      "online": true,
      "adopting": false,
      "device_type": "UVC G6 Pro Entry",
      "connected_hub_id": "",
      "location_id": "",
      "firmware": "5.3.95",
      "version": "",
      "guid": "00000000-0000-0000-0000-000000000034",
      "start_time": 1782282073038,
      "hw_type": "",
      "revision": "",
      "cap": [
        "capture",
        "support_register_card"
      ],
      "category": [
        "camera"
      ]
    },
    "meta": {

      "object_type": "device",
      "target_field": null,
      "all_field": true,
      "id": "00000000000000000000000c",
      "source": ""
    }
  },
  {

    "event": "access.data.v2.location.update",
    "receiver_id": "",
    "event_object_id": "00000000-0000-0000-0000-000000000036",
    "save_to_history": false,
    "data": {

      "id": "00000000-0000-0000-0000-000000000006",
      "location_type": "door",
      "name": "Test Name 10",
      "up_id": "00000000-0000-0000-0000-000000000001",
      "extras": null,
      "device_ids": [
        "aabbcc000001",
        "aabbcc000002",
        "aabbcc000003"
      ],
      "thumbnail": {

        "type": "thumbnail",
        "url": "REDACTED-0000001f-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        "door_thumbnail_last_update": 1786606388
      }
    },
    "meta": {

      "object_type": "location",
      "target_field": [
        "thumbnail"
      ],
      "all_field": false,
      "id": "00000000-0000-0000-0000-000000000006",
      "source": ""
    }
  },
  {

    "event": "access.data.location.update",
    "receiver_id": "",
    "event_object_id": "00000000-0000-0000-0000-000000000006",
    "save_to_history": false,
    "data": {

      "unique_id": "00000000-0000-0000-0000-000000000006",
      "name": "Test Name 10",
      "up_id": "00000000-0000-0000-0000-000000000001",
      "timezone": "",
      "location_type": "door",
      "extra_type": "",
      "full_name": "Test Name 11",
      "level": 0,
      "work_time": "[]",
      "work_time_id": "",
      "extras": {

        "door_thumbnail": "REDACTED-0000001f-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        "door_thumbnail_last_update": 1786606388,
        "uah-input_state_dps": "off",
        "uah-wiring_state_dps-neg": "off",
        "uah-wiring_state_dps-pos": "off"
      },
      "previous_name": null
    }
  },
  {

    "event": "access.data.device.update",
    "receiver_id": "",
    "event_object_id": "aabbcc000002",
    "save_to_history": false,
    "data": {

      "unique_id": "aabbcc000002",
      "name": "Test Name 68",
      "alias": "",
      "device_type": "UA-G2-PRO",
      "connected_uah_id": "aabbcc000001",
      "location_id": "00000000-0000-0000-0000-000000000006",
      "firmware": "v1.14.17.0",
      "version": "v3.14.4552",
      "ip": "192.0.2.3",
      "mac": "aa:bb:cc:00:00:02",
      "hw_type": "GA",
      "start_time": 1784045238,
      "last_seen": 1785619578,
      "security_check": true,
      "source": "",
      "bom_rev": "01",
      "guid": "00000000-0000-0000-0000-000000000009",
      "need_advisory": false,
      "is_camera": false,
      "is_adopted": true,
      "is_managed": true,
      "is_connected": true,
      "is_online": true,
      "is_rebooting": false,
      "is_unavailable": false,
      "is_upgrade_blocked": false,
      "is_export_sf_blocked": false,
      "adopting": false,
      "location": {

        "unique_id": "00000000-0000-0000-0000-000000000006",
        "name": "Test Name 10",
        "up_id": "00000000-0000-0000-0000-000000000001",
        "timezone": "",
        "location_type": "door",
        "extra_type": "",
        "full_name": "Test Name 11",
        "level": 0,
        "work_time": "[]",
        "work_time_id": "",
        "extras": {

          "door_thumbnail": "REDACTED-0000001f-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
          "door_thumbnail_last_update": 1786606388,
          "uah-input_state_dps": "off",
          "uah-wiring_state_dps-neg": "off",
          "uah-wiring_state_dps-pos": "off"
        },
        "previous_name": null
      },
      "door": {

        "unique_id": "00000000-0000-0000-0000-000000000006",
        "name": "Test Name 10",
        "up_id": "00000000-0000-0000-0000-000000000001",
        "timezone": "",
        "location_type": "door",
        "extra_type": "",
        "full_name": "Test Name 11",
        "level": 0,
        "work_time": "[]",
        "work_time_id": "",
        "extras": {

          "door_thumbnail": "REDACTED-0000001f-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
          "door_thumbnail_last_update": 1786606388,
          "uah-input_state_dps": "off",
          "uah-wiring_state_dps-neg": "off",
          "uah-wiring_state_dps-pos": "off"
        },
        "previous_name": null
      },
      "floor": {

        "unique_id": "00000000-0000-0000-0000-000000000001",
        "name": "Test Name 2",
        "up_id": "00000000-0000-0000-0000-000000000000",
        "timezone": "",
        "location_type": "floor",
        "extra_type": "",
        "full_name": "Test Name 3",
        "level": 1,
        "work_time": "[]",
        "work_time_id": "",
        "extras": {},
        "previous_name": null
      },
      "configs": [
        {

          "device_id": "aabbcc000002",
          "key": "ssh_user",
          "value": "Test username 8",
          "tag": "credential",
          "update_time": "2024-06-30T18:03:49-05:00",
          "create_time": "2024-06-30T13:03:49-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "cert_fingerprint",
          "value": "0000000000000000000000000000000000000003",
          "tag": "credential",
          "update_time": "2024-06-30T18:03:49-05:00",
          "create_time": "2024-06-30T13:03:49-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "door_entry_method",
          "value": "in",
          "tag": "door_entry_method",
          "update_time": "2024-06-30T18:03:49-05:00",
          "create_time": "2024-06-30T13:03:49-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "capture_record_extra_before",
          "value": "5",
          "tag": "device_setting",
          "update_time": "2024-06-30T18:03:49-05:00",
          "create_time": "2024-06-30T13:03:49-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "capture_record_extra_after",
          "value": "5",
          "tag": "device_setting",
          "update_time": "2024-06-30T18:03:49-05:00",
          "create_time": "2024-06-30T13:03:49-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "alias",
          "value": "",
          "tag": "device_extra",
          "update_time": "2024-06-30T18:03:49-05:00",
          "create_time": "2024-06-30T13:03:49-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "nacl_public_key",
          "value": "REDACTED-00000007-xxxxxxxxxxxxxxxxxxxxxxxxxx",
          "tag": "credential",
          "update_time": "2024-06-30T18:03:49-05:00",
          "create_time": "2024-06-30T13:03:49-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "nfc",
          "value": "yes",
          "tag": "open_door_mode",
          "update_time": "2026-01-24T03:15:48-06:00",
          "create_time": "2024-06-30T13:03:49-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "nacl_private_key",
          "value": "REDACTED-00000006-xxxxxxxxxxxxxxxxxxxxxxxxxx",
          "tag": "credential",
          "update_time": "2026-02-10T15:44:17-06:00",
          "create_time": "2026-02-10T09:44:17-06:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "bt_button",
          "value": "yes",
          "tag": "open_door_mode",
          "update_time": "2026-01-24T02:41:01-06:00",
          "create_time": "2024-06-30T13:03:49-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "tof_distance",
          "value": "2000",
          "tag": "device_setting",
          "update_time": "2024-06-30T18:03:50-05:00",
          "create_time": "2024-06-30T13:03:50-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "volume",
          "value": "36",
          "tag": "device_setting",
          "update_time": "2024-06-30T18:03:50-05:00",
          "create_time": "2024-06-30T13:03:50-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "brightness",
          "value": "36",
          "tag": "device_setting",
          "update_time": "2024-06-30T18:03:50-05:00",
          "create_time": "2024-06-30T13:03:50-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "greeting_text",
          "value": "welcome",
          "tag": "device_setting",
          "update_time": "2024-06-30T18:03:50-05:00",
          "create_time": "2024-06-30T13:03:50-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "greeting_broadcast_name",
          "value": "first_name_only",
          "tag": "device_setting",
          "update_time": "2024-06-30T18:03:50-05:00",
          "create_time": "2024-06-30T13:03:50-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "pin_code_shuffle",
          "value": "no",
          "tag": "device_setting",
          "update_time": "2024-06-30T18:03:50-05:00",
          "create_time": "2024-06-30T13:03:50-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "door_bell_trigger_interface",
          "value": "swipe",
          "tag": "device_setting",
          "update_time": "2024-06-30T18:03:50-05:00",
          "create_time": "2024-06-30T13:03:50-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "pin_code",
          "value": "REDACTED-00000008-",
          "tag": "open_door_mode",
          "update_time": "2025-11-10T01:14:50-06:00",
          "create_time": "2024-06-30T13:03:49-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "ibeacon_uuid",
          "value": "00000000-0000-0000-0000-000000000004",
          "tag": "device_setting",
          "update_time": "2024-09-06T04:16:42-05:00",
          "create_time": "2024-06-30T13:03:49-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "ibeacon_major",
          "value": "0",
          "tag": "device_setting",
          "update_time": "2024-09-06T04:16:42-05:00",
          "create_time": "2024-06-30T13:03:49-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "ibeacon_minor",
          "value": "1",
          "tag": "device_setting",
          "update_time": "2024-09-06T04:16:42-05:00",
          "create_time": "2024-06-30T13:03:49-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "bt",
          "value": "yes",
          "tag": "open_door_mode",
          "update_time": "2024-09-06T04:16:42-05:00",
          "create_time": "2024-06-30T13:03:49-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "pin_code_disable",
          "value": "no",
          "tag": "device_setting",
          "update_time": "2024-06-30T18:07:02-05:00",
          "create_time": "2024-06-30T13:07:02-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "mobile_unlock_ver2",
          "value": "yes",
          "tag": "device_setting",
          "update_time": "2024-12-07T01:06:22-06:00",
          "create_time": "2024-12-06T19:06:22-06:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "capture_enable",
          "value": "no",
          "tag": "device_setting",
          "update_time": "2025-01-28T15:24:16-06:00",
          "create_time": "2025-01-28T09:24:16-06:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "disable_recording_default",
          "value": "yes",
          "tag": "device_setting",
          "update_time": "2025-01-17T16:57:19-06:00",
          "create_time": "2025-01-17T10:57:19-06:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "bt_tap",
          "value": "yes",
          "tag": "open_door_mode",
          "update_time": "2026-01-24T02:41:01-06:00",
          "create_time": "2025-03-29T15:50:00-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "call_volume",
          "value": "80",
          "tag": "device_setting",
          "update_time": "2025-01-28T13:52:43-06:00",
          "create_time": "2025-01-28T07:52:43-06:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "show_entry_greet",
          "value": "yes",
          "tag": "device_setting",
          "update_time": "2025-03-10T20:40:51-05:00",
          "create_time": "2025-03-10T15:40:51-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "show_unlock_schedule",
          "value": "yes",
          "tag": "device_setting",
          "update_time": "2025-03-10T20:41:01-05:00",
          "create_time": "2025-03-10T15:41:01-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "qr_code",
          "value": "yes",
          "tag": "open_door_mode",
          "update_time": "2025-11-09T20:37:39-06:00",
          "create_time": "2025-01-28T07:52:44-06:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "face_detect_distance",
          "value": "near",
          "tag": "device_setting",
          "update_time": "2026-01-24T03:15:54-06:00",
          "create_time": "2025-09-13T11:30:00-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "apple_pass",
          "value": "no",
          "tag": "open_door_mode",
          "update_time": "2025-07-16T13:49:37-05:00",
          "create_time": "2025-07-16T08:49:37-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "face_anti_spoofing_level",
          "value": "high",
          "tag": "device_setting",
          "update_time": "2026-01-24T03:15:54-06:00",
          "create_time": "2025-09-13T11:19:58-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "face",
          "value": "yes",
          "tag": "open_door_mode",
          "update_time": "2026-01-24T03:15:58-06:00",
          "create_time": "2025-09-13T11:19:58-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "welcome_led",
          "value": "yes",
          "tag": "device_setting",
          "update_time": "2026-07-12T11:26:33-05:00",
          "create_time": "2026-07-12T11:26:33-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "capture_tof_enable",
          "value": "yes",
          "tag": "device_setting",
          "update_time": "2026-07-12T11:26:33-05:00",
          "create_time": "2026-07-12T11:26:33-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "show_auth_method",
          "value": "yes",
          "tag": "device_setting",
          "update_time": "2026-07-12T11:26:33-05:00",
          "create_time": "2026-07-12T11:26:33-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "status_led",
          "value": "yes",
          "tag": "device_setting",
          "update_time": "2026-07-12T11:26:33-05:00",
          "create_time": "2026-07-12T11:26:33-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "door_bell_trigger_type",
          "value": "on",
          "tag": "device_setting",
          "update_time": "2026-07-12T11:26:33-05:00",
          "create_time": "2026-07-12T11:26:33-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "ssh_password",
          "value": "REDACTED-0000000a-xx",
          "tag": "credential",
          "update_time": "2026-08-01T00:00:00-05:00",
          "create_time": "2024-06-30T13:03:49-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "preview",
          "value": "REDACTED-00000020-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
          "tag": "device_extra",
          "update_time": "2026-08-13T02:33:08-05:00",
          "create_time": "2024-06-30T13:03:51-05:00"
        }
      ],
      "update": null,
      "update_manual": {

        "device_version_upgrade_status": {

          "completed": false,
          "is_waiting": false,
          "is_preparing": false,
          "is_upgrading": false,
          "upgrade_seconds": 0,
          "timed_out": false,
          "failed": false,
          "failure_reason": "",
          "is_downloading": false
        },
        "device_type": "",
        "from_version": "",
        "last_upgrade_start_time": null,
        "last_upgrade_success": null,
        "last_upgrade_failure_reason": "",
        "last_download_start_time": null,
        "last_download_success": null,
        "last_download_failure_reason": "",
        "downloaded": false
      },
      "capabilities": [
        "pin_code",
        "pin_code_length",
        "change_setting",
        "remote_view",
        "remote_call",
        "ssh_change",
        "support_register_card",
        "is_reader",
        "identity_is_reader",
        "identity_remote_view",
        "support_reboot",
        "support_greeting",
        "support_greeting_message",
        "support_salutation",
        "keypad_layout",
        "support_ui_account",
        "support_webrtc",
        "identity_support_webrtc",
        "support_uid_webrtc",
        "support_upgrade_by_url",
        "support_record_extra",
        "doorbell_timeout",
        "doorbell_bind",
        "post_capture",
        "hold_to_call",
        "support_face",
        "identity_face_unlock",
        "mobile_unlock_ver2",
        "adopt_under_console",
        "support_ems",
        "identity_support_ems",
        "anti_spoofing_level",
        "show_face_method",
        "support_faceme_sdk",
        "support_twilio_sip",
        "qr_code",
        "support_record_hq_stream",
        "report_audio_setting",
        "support_interface_design",
        "support_generic_resource_key",
        "show_unlock_schedule",
        "video_overlay",
        "two_factor_auth",
        "support_face_sensitivity",
        "support_third_party_sip",
        "nfc_card_easy_provision",
        "mic_management",
        "screen_off_timeout",
        "support_sip_tls",
        "identity_unlock_control_cmd",
        "double_badge"
      ],
      "resource_name": "Test Name 19",
      "display_model": "UA G2 Pro",
      "revision": "1785876758583455467",
      "revision_update_time": 1785876788,
      "version_update_time": -62135596800,
      "firmware_update_time": -62135596800,
      "adopt_time": 1719770629,
      "extensions": [
        {

          "unique_id": "00000000-0000-0000-0000-00000000000a",
          "device_id": "aabbcc000002",
          "extension_name": "intercom_pair",
          "target_type": "admin",
          "target_config": [
            {

              "config_tag": "",
              "config_key": "",
              "config_value": "00000000-0000-0000-0000-00000000000b"
            },
            {

              "config_tag": "",
              "config_key": "",
              "config_value": "00000000-0000-0000-0000-00000000000c"
            }
          ]
        }
      ],
      "model": "UA G2 Pro",
      "images": {

        "xs": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006a_25x25.png",
        "s": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006a_32x32.png",
        "m": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006a_51x51.png",
        "l": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006a_64x64.png",
        "xl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006a_101x101.png",
        "xxl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006a_128x128.png",
        "base": "icons/00000000-0000-0000-0000-00000000006a_257x257.png",
        "animation": [
          "icons/g2-pro-black-close.png",
          "icons/g2-pro-black-open.png"
        ]
      },
      "camera_setting": {

        "cameraId": "000000000000000000000002",
        "recordingSettings": {

          "mode": "never",
          "prePaddingSecs": 5,
          "postPaddingSecs": 5,
          "smartDetectPrePaddingSecs": 2,
          "smartDetectPostPaddingSecs": 2,
          "minMotionEventTrigger": 1000,
          "endMotionEventDelay": 3000,
          "suppressIlluminationSurge": false,
          "inScheduleMode": "always",
          "outScheduleMode": "never",
          "geofencing": "off",
          "motionAlgorithm": "enhanced",
          "enableMotionDetection": false,
          "createAccessEvent": true,
          "useNewMotionAlgorithm": true
        },
        "osdSettings": {

          "isNameEnabled": false,
          "isDateEnabled": false,
          "isLogoEnabled": false,
          "isDebugEnabled": false
        },
        "micVolume": 100,
        "isMicEnabled": true
      },
      "template": null
    }
  },
  {

    "event": "access.data.v2.location.update",
    "receiver_id": "",
    "event_object_id": "00000000-0000-0000-0000-000000000037",
    "save_to_history": false,
    "data": {

      "id": "00000000-0000-0000-0000-000000000006",
      "location_type": "door",
      "name": "Test Name 10",
      "up_id": "00000000-0000-0000-0000-000000000001",
      "extras": null,
      "device_ids": [
        "aabbcc000001",
        "aabbcc000002",
        "aabbcc000003"
      ],
      "guard": [
        {

          "id": "00000000-0000-0000-0000-00000000000b",
          "name": "Test Name 69",
          "alias": "",
          "first_name": "Test first_name 70",
          "last_name": "Test last_name 71",
          "avatar": ""
        },
        {

          "id": "00000000-0000-0000-0000-00000000000c",
          "name": "Test Name 72",
          "alias": "",
          "first_name": "Test first_name 73",
          "last_name": "Test last_name 74",
          "avatar": ""
        }
      ],
      "state": {

        "lock": "locked",
        "dps": "none",
        "dps_connected": false,
        "unlock_suspend": {

          "status": "end",
          "unlock_type": ""
        },
        "emergency": {

          "software": "none",
          "hardware": "none"
        },
        "is_unavailable": false
      },
      "thumbnail": {

        "type": "thumbnail",
        "url": "REDACTED-0000001f-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        "door_thumbnail_last_update": 1786606388
      },
      "last_activity": 1782959614
    },
    "meta": {

      "object_type": "location",
      "target_field": null,
      "all_field": true,
      "id": "00000000-0000-0000-0000-000000000006",
      "source": ""
    }
  },
  {

    "event": "access.data.v2.device.update",
    "receiver_id": "",
    "event_object_id": "00000000-0000-0000-0000-000000000038",
    "save_to_history": false,
    "data": {

      "name": "Test Name 68",
      "alias": "Test alias 75",
      "id": "aabbcc000002",
      "ip": "192.0.2.3",
      "mac": "aa:bb:cc:00:00:02",
      "online": true,
      "adopting": false,
      "device_type": "UA-G2-PRO",
      "connected_hub_id": "aabbcc000001",
      "location_id": "00000000-0000-0000-0000-000000000006",
      "firmware": "v1.14.17.0",
      "version": "v3.14.4552",
      "guid": "00000000-0000-0000-0000-000000000009",
      "start_time": 1784045238,
      "hw_type": "GA",
      "revision": "1786095367040183648",
      "access_method": {

        "nfc": "yes",
        "bt_button": "yes",
        "bt_tap": "yes",
        "face": "yes",
        "pin_code": "REDACTED-00000008-",
        "qr_code": "yes"
      },
      "cap": null,
      "direction": "entry",
      "settings": [
        {

          "key": "brightness",
          "tag": "device_setting",
          "value": "36"
        },
        {

          "key": "volume",
          "tag": "device_setting",
          "value": "36"
        },
        {

          "key": "capture_tof_enable",
          "tag": "device_setting",
          "value": "yes"
        },
        {

          "key": "door_bell_trigger_type",
          "tag": "device_setting",
          "value": "on"
        },
        {

          "key": "door_bell_trigger_interface",
          "tag": "device_setting",
          "value": "swipe"
        },
        {

          "key": "show_auth_method",
          "tag": "device_setting",
          "value": "yes"
        },
        {

          "key": "capture_record_extra_before",
          "tag": "device_setting",
          "value": "5"
        },
        {

          "key": "tof_distance",
          "tag": "device_setting",
          "value": "2000"
        }
      ],
      "category": [
        "ua-pro"
      ]
    },
    "meta": {

      "object_type": "device",
      "target_field": [
        "access_method",
        "settings",
        "direction"
      ],
      "all_field": false,
      "id": "aabbcc000002",
      "source": ""
    }
  },
  {

    "event": "access.data.v2.location.update",
    "receiver_id": "",
    "event_object_id": "00000000-0000-0000-0000-000000000039",
    "save_to_history": false,
    "data": {

      "id": "00000000-0000-0000-0000-000000000006",
      "location_type": "door",
      "name": "Test Name 10",
      "up_id": "00000000-0000-0000-0000-000000000001",
      "extras": null,
      "device_ids": [
        "aabbcc000001",
        "aabbcc000002",
        "aabbcc000003"
      ],
      "guard": [
        {

          "id": "00000000-0000-0000-0000-00000000000b",
          "name": "Test Name 69",
          "alias": "",
          "first_name": "Test first_name 70",
          "last_name": "Test last_name 71",
          "avatar": ""
        },
        {

          "id": "00000000-0000-0000-0000-00000000000c",
          "name": "Test Name 72",
          "alias": "",
          "first_name": "Test first_name 73",
          "last_name": "Test last_name 74",
          "avatar": ""
        }
      ],
      "state": {

        "lock": "locked",
        "dps": "none",
        "dps_connected": false,
        "unlock_suspend": {

          "status": "end",
          "unlock_type": ""
        },
        "emergency": {

          "software": "none",
          "hardware": "none"
        },
        "is_unavailable": false
      },
      "thumbnail": {

        "type": "thumbnail",
        "url": "REDACTED-0000001f-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        "door_thumbnail_last_update": 1786606388
      },
      "last_activity": 1782959614
    },
    "meta": {

      "object_type": "location",
      "target_field": null,
      "all_field": true,
      "id": "00000000-0000-0000-0000-000000000006",
      "source": ""
    }
  },
  {

    "event": "access.data.device.update",
    "receiver_id": "",
    "event_object_id": "aabbcc000001",
    "save_to_history": false,
    "data": {

      "unique_id": "aabbcc000001",
      "name": "Test Name 76",
      "alias": "Test alias 13",
      "device_type": "UAH",
      "connected_uah_id": "",
      "location_id": "00000000-0000-0000-0000-000000000006",
      "firmware": "v4.12.19.0",
      "version": "v4.12.195",
      "ip": "192.0.2.2",
      "mac": "aa:bb:cc:00:00:01",
      "hw_type": "",
      "start_time": 1780317315,
      "last_seen": 1785619578,
      "security_check": false,
      "source": "",
      "bom_rev": "",
      "guid": "00000000-0000-0000-0000-000000000007",
      "need_advisory": false,
      "is_camera": false,
      "is_adopted": true,
      "is_managed": true,
      "is_connected": true,
      "is_online": true,
      "is_rebooting": false,
      "is_unavailable": false,
      "is_upgrade_blocked": false,
      "is_export_sf_blocked": false,
      "adopting": false,
      "location": {

        "unique_id": "00000000-0000-0000-0000-000000000006",
        "name": "Test Name 10",
        "up_id": "00000000-0000-0000-0000-000000000001",
        "timezone": "",
        "location_type": "door",
        "extra_type": "",
        "full_name": "Test Name 11",
        "level": 0,
        "work_time": "[]",
        "work_time_id": "",
        "extras": {

          "door_thumbnail": "REDACTED-0000001f-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
          "door_thumbnail_last_update": 1786606388,
          "uah-input_state_dps": "off",
          "uah-wiring_state_dps-neg": "off",
          "uah-wiring_state_dps-pos": "off"
        },
        "previous_name": null
      },
      "door": {

        "unique_id": "00000000-0000-0000-0000-000000000006",
        "name": "Test Name 10",
        "up_id": "00000000-0000-0000-0000-000000000001",
        "timezone": "",
        "location_type": "door",
        "extra_type": "",
        "full_name": "Test Name 11",
        "level": 0,
        "work_time": "[]",
        "work_time_id": "",
        "extras": {

          "door_thumbnail": "REDACTED-0000001f-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
          "door_thumbnail_last_update": 1786606388,
          "uah-input_state_dps": "off",
          "uah-wiring_state_dps-neg": "off",
          "uah-wiring_state_dps-pos": "off"
        },
        "previous_name": null
      },
      "floor": {

        "unique_id": "00000000-0000-0000-0000-000000000001",
        "name": "Test Name 2",
        "up_id": "00000000-0000-0000-0000-000000000000",
        "timezone": "",
        "location_type": "floor",
        "extra_type": "",
        "full_name": "Test Name 3",
        "level": 1,
        "work_time": "[]",
        "work_time_id": "",
        "extras": {},
        "previous_name": null
      },
      "configs": [
        {

          "device_id": "aabbcc000001",
          "key": "ssh_user",
          "value": "Test username 8",
          "tag": "credential",
          "update_time": "2024-06-30T18:03:48-05:00",
          "create_time": "2024-06-30T13:03:48-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "cert_fingerprint",
          "value": "0000000000000000000000000000000000000001",
          "tag": "credential",
          "update_time": "2024-06-30T18:03:48-05:00",
          "create_time": "2024-06-30T13:03:48-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "uah_token",
          "value": "REDACTED-00000005-xxxxxxxxxxxxxxxxxx",
          "tag": "uah_config",
          "update_time": "2024-06-30T18:03:48-05:00",
          "create_time": "2024-06-30T13:03:48-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "hold_relay_seconds",
          "value": "5",
          "tag": "uah_config",
          "update_time": "2024-06-30T18:03:48-05:00",
          "create_time": "2024-06-30T13:03:48-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "output_aux_mode",
          "value": "normal",
          "tag": "uah_config",
          "update_time": "2024-06-30T18:03:48-05:00",
          "create_time": "2024-06-30T13:03:48-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "aux_mode_dry",
          "value": "opener",
          "tag": "uah_config",
          "update_time": "2024-06-30T18:03:48-05:00",
          "create_time": "2024-06-30T13:03:48-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "aux_mode_wet",
          "value": "bell",
          "tag": "uah_config",
          "update_time": "2024-06-30T18:03:48-05:00",
          "create_time": "2024-06-30T13:03:48-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "aux_delay_time",
          "value": "0.1",
          "tag": "uah_config",
          "update_time": "2024-06-30T18:03:48-05:00",
          "create_time": "2024-06-30T13:03:48-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "nacl_public_key",
          "value": "REDACTED-00000003-xxxxxxxxxxxxxxxxxxxxxxxxxx",
          "tag": "credential",
          "update_time": "2024-06-30T18:03:48-05:00",
          "create_time": "2024-06-30T13:03:48-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "nacl_private_key",
          "value": "REDACTED-00000002-xxxxxxxxxxxxxxxxxxxxxxxxxx",
          "tag": "credential",
          "update_time": "2026-04-24T21:59:56-05:00",
          "create_time": "2026-04-24T16:59:56-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "aux_delay_wet",
          "value": "0.1",
          "tag": "uah_config",
          "update_time": "2024-06-30T18:03:53-05:00",
          "create_time": "2024-06-30T13:03:53-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "wiring_state_rex-pos",
          "value": "off",
          "tag": "wiring_state",
          "update_time": "2024-06-30T18:04:01-05:00",
          "create_time": "2024-06-30T13:04:01-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "wiring_state_dps-pos",
          "value": "off",
          "tag": "wiring_state",
          "update_time": "2024-06-30T18:04:01-05:00",
          "create_time": "2024-06-30T13:04:01-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "wiring_state_dps-neg",
          "value": "off",
          "tag": "wiring_state",
          "update_time": "2024-06-30T18:04:01-05:00",
          "create_time": "2024-06-30T13:04:01-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "input_state_EMERGY",
          "value": "off",
          "tag": "input_state",
          "update_time": "2024-06-30T18:04:01-05:00",
          "create_time": "2024-06-30T13:04:01-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "wiring_state_rel-neg",
          "value": "off",
          "tag": "wiring_state",
          "update_time": "2024-06-30T18:04:01-05:00",
          "create_time": "2024-06-30T13:04:01-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "wiring_state_lock-dry-no",
          "value": "off",
          "tag": "wiring_state",
          "update_time": "2024-06-30T18:04:01-05:00",
          "create_time": "2024-06-30T13:04:01-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "wiring_state_lock-dry-com",
          "value": "off",
          "tag": "wiring_state",
          "update_time": "2024-06-30T18:04:01-05:00",
          "create_time": "2024-06-30T13:04:01-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "wiring_state_lock-dry-nc",
          "value": "off",
          "tag": "wiring_state",
          "update_time": "2024-06-30T18:04:01-05:00",
          "create_time": "2024-06-30T13:04:01-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "alias",
          "value": "Test alias 13",
          "tag": "device_extra",
          "update_time": "2025-06-14T11:36:47-05:00",
          "create_time": "2024-06-30T13:03:48-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "wiring_state_ren-neg",
          "value": "off",
          "tag": "wiring_state",
          "update_time": "2024-06-30T18:04:00-05:00",
          "create_time": "2024-06-30T13:04:00-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "wiring_state_bitmap",
          "value": "83886080",
          "tag": "wiring_state",
          "update_time": "2026-01-24T04:16:31-06:00",
          "create_time": "2024-06-30T13:04:00-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "unlock_suspend_status",
          "value": "end",
          "tag": "device_setting",
          "update_time": "2026-06-01T12:38:12-05:00",
          "create_time": "2026-06-01T07:38:12-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "unlock_suspend_type",
          "value": "",
          "tag": "device_setting",
          "update_time": "2026-06-01T12:38:12-05:00",
          "create_time": "2026-06-01T07:38:12-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "unlock_suspend_types",
          "value": "",
          "tag": "device_setting",
          "update_time": "2026-06-01T12:38:12-05:00",
          "create_time": "2026-06-01T07:38:12-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "unlock_schedule_suspend_end_time",
          "value": "0",
          "tag": "device_setting",
          "update_time": "2026-06-01T12:38:12-05:00",
          "create_time": "2026-06-01T07:38:12-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "temporary_unlock_suspend_end_time",
          "value": "0",
          "tag": "device_setting",
          "update_time": "2026-06-01T12:38:12-05:00",
          "create_time": "2026-06-01T07:38:12-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "wiring_state_12v-pos",
          "value": "off",
          "tag": "wiring_state",
          "update_time": "2024-06-30T18:04:00-05:00",
          "create_time": "2024-06-30T13:04:00-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "wiring_state_12v-neg",
          "value": "off",
          "tag": "wiring_state",
          "update_time": "2024-06-30T18:04:00-05:00",
          "create_time": "2024-06-30T13:04:00-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "input_state_rel",
          "value": "off",
          "tag": "input_state",
          "update_time": "2024-06-30T18:04:01-05:00",
          "create_time": "2024-06-30T13:04:01-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "wiring_state_lock-wet-no",
          "value": "off",
          "tag": "wiring_state",
          "update_time": "2024-06-30T18:04:01-05:00",
          "create_time": "2024-06-30T13:04:01-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "wiring_state_lock-wet-com",
          "value": "off",
          "tag": "wiring_state",
          "update_time": "2024-06-30T18:04:01-05:00",
          "create_time": "2024-06-30T13:04:01-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "wiring_state_lock-wet-nc",
          "value": "off",
          "tag": "wiring_state",
          "update_time": "2024-06-30T18:04:01-05:00",
          "create_time": "2024-06-30T13:04:01-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "wiring_state_aux-dry-no",
          "value": "off",
          "tag": "wiring_state",
          "update_time": "2024-06-30T18:04:01-05:00",
          "create_time": "2024-06-30T13:04:01-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "wiring_state_aux-dry-com",
          "value": "off",
          "tag": "wiring_state",
          "update_time": "2024-06-30T18:04:01-05:00",
          "create_time": "2024-06-30T13:04:01-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "wiring_state_aux-dry-cn",
          "value": "off",
          "tag": "wiring_state",
          "update_time": "2024-06-30T18:04:01-05:00",
          "create_time": "2024-06-30T13:04:01-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "wiring_state_aux-dry-nc",
          "value": "off",
          "tag": "wiring_state",
          "update_time": "2024-06-30T18:04:01-05:00",
          "create_time": "2024-06-30T13:04:01-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "wiring_state_aux-wet-no",
          "value": "off",
          "tag": "wiring_state",
          "update_time": "2024-06-30T18:04:01-05:00",
          "create_time": "2024-06-30T13:04:01-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "wiring_state_aux-wet-com",
          "value": "off",
          "tag": "wiring_state",
          "update_time": "2024-06-30T18:04:01-05:00",
          "create_time": "2024-06-30T13:04:01-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "wiring_state_aux-wet-nc",
          "value": "off",
          "tag": "wiring_state",
          "update_time": "2024-06-30T18:04:01-05:00",
          "create_time": "2024-06-30T13:04:01-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "wiring_state_support-bitmap",
          "value": "on",
          "tag": "wiring_state",
          "update_time": "2024-06-30T18:04:01-05:00",
          "create_time": "2024-06-30T13:04:01-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "poe-type",
          "value": "802.3bt",
          "tag": "device_extra",
          "update_time": "2024-06-30T18:04:01-05:00",
          "create_time": "2024-06-30T13:04:01-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "wiring_state_poe-p2-enter",
          "value": "off",
          "tag": "wiring_state",
          "update_time": "2026-01-24T04:18:32-06:00",
          "create_time": "2024-06-30T13:04:01-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "input_state_rly-lock_dry",
          "value": "off",
          "tag": "input_state",
          "update_time": "2025-03-29T21:05:46-05:00",
          "create_time": "2024-06-30T13:04:01-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "wiring_state_poe-p1-exit",
          "value": "on",
          "tag": "wiring_state",
          "update_time": "2025-05-16T16:15:32-05:00",
          "create_time": "2024-06-30T13:04:01-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "wiring_state_poe-p3-camera",
          "value": "on",
          "tag": "wiring_state",
          "update_time": "2025-05-16T17:10:32-05:00",
          "create_time": "2024-06-30T13:04:01-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "wiring_state_ren-pos",
          "value": "off",
          "tag": "wiring_state",
          "update_time": "2024-06-30T18:04:00-05:00",
          "create_time": "2024-06-30T13:04:00-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "input_state_ren",
          "value": "off",
          "tag": "input_state",
          "update_time": "2024-06-30T18:04:01-05:00",
          "create_time": "2024-06-30T13:04:01-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "input_state_rex",
          "value": "off",
          "tag": "input_state",
          "update_time": "2024-06-30T18:04:01-05:00",
          "create_time": "2024-06-30T13:04:01-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "wiring_state_rex-neg",
          "value": "off",
          "tag": "wiring_state",
          "update_time": "2024-06-30T18:04:01-05:00",
          "create_time": "2024-06-30T13:04:01-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "input_state_dps",
          "value": "off",
          "tag": "input_state",
          "update_time": "2024-06-30T18:04:01-05:00",
          "create_time": "2024-06-30T13:04:01-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "wiring_state_rel-pos",
          "value": "off",
          "tag": "wiring_state",
          "update_time": "2024-06-30T18:04:01-05:00",
          "create_time": "2024-06-30T13:04:01-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "input_state_SW-EMERGY",
          "value": "off",
          "tag": "input_state",
          "update_time": "2024-06-30T18:04:01-05:00",
          "create_time": "2024-06-30T13:04:01-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "lock_time_period",
          "value": "",
          "tag": "uah_config",
          "update_time": "2024-10-04T15:31:27-05:00",
          "create_time": "2024-07-12T12:04:54-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "port-mac-6",
          "value": "aa:bb:cc:00:00:01",
          "tag": "hub_action",
          "update_time": "2024-07-09T17:25:12-05:00",
          "create_time": "2024-07-09T12:25:12-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "lock_now_mode",
          "value": "disable_unlock_period",
          "tag": "uah_config",
          "update_time": "2025-03-29T21:49:02-05:00",
          "create_time": "2025-03-29T16:49:02-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "unlock_time_period",
          "value": "",
          "tag": "uah_config",
          "update_time": "2025-03-29T22:02:40-05:00",
          "create_time": "2024-07-09T10:37:08-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "temp_lock_type",
          "value": "lock_now",
          "tag": "uah_config",
          "update_time": "2025-03-29T22:02:40-05:00",
          "create_time": "2024-07-09T10:37:08-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "lock_type",
          "value": "",
          "tag": "uah_config",
          "update_time": "2025-03-29T22:02:40-05:00",
          "create_time": "2024-06-30T13:05:14-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "lock_end_time",
          "value": "0",
          "tag": "uah_config",
          "update_time": "2025-03-29T22:02:40-05:00",
          "create_time": "2024-06-30T13:05:14-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "port-mac-1",
          "value": "aa:bb:cc:00:00:02",
          "tag": "hub_action",
          "update_time": "2026-07-14T11:07:27-05:00",
          "create_time": "2024-07-09T12:25:12-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "port-mac-8",
          "value": "",
          "tag": "hub_action",
          "update_time": "2025-10-05T23:07:13-05:00",
          "create_time": "2025-10-05T18:07:01-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "port-mac-136",
          "value": "",
          "tag": "hub_action",
          "update_time": "2025-11-07T21:25:18-06:00",
          "create_time": "2025-11-07T15:25:08-06:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "port-mac-2",
          "value": "",
          "tag": "hub_action",
          "update_time": "2026-01-24T04:16:34-06:00",
          "create_time": "2026-01-22T16:07:54-06:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "input_emer_mode",
          "value": "no",
          "tag": "uah_config",
          "update_time": "2026-07-12T11:26:33-05:00",
          "create_time": "2026-07-12T11:26:33-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "aux_wet_bell_time",
          "value": "0.5",
          "tag": "uah_config",
          "update_time": "2026-07-12T11:26:33-05:00",
          "create_time": "2026-07-12T11:26:33-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "input_rel_mode",
          "value": "no",
          "tag": "uah_config",
          "update_time": "2026-07-12T11:26:33-05:00",
          "create_time": "2026-07-12T11:26:33-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "aux_wet_siren_time",
          "value": "60",
          "tag": "uah_config",
          "update_time": "2026-07-12T11:26:33-05:00",
          "create_time": "2026-07-12T11:26:33-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "aux_delay_dry",
          "value": "0.1",
          "tag": "uah_config",
          "update_time": "2026-07-12T11:26:33-05:00",
          "create_time": "2026-07-12T11:26:33-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "aux_hold_dry",
          "value": "5",
          "tag": "uah_config",
          "update_time": "2026-07-12T11:26:33-05:00",
          "create_time": "2026-07-12T11:26:33-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "rex_button_mode",
          "value": "push",
          "tag": "uah_config",
          "update_time": "2026-07-12T11:26:33-05:00",
          "create_time": "2026-07-12T11:26:33-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "emergency_mode",
          "value": "evacuate",
          "tag": "uah_config",
          "update_time": "2026-07-12T11:26:33-05:00",
          "create_time": "2026-07-12T11:26:33-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "aux_dry_siren_time",
          "value": "60",
          "tag": "uah_config",
          "update_time": "2026-07-12T11:26:33-05:00",
          "create_time": "2026-07-12T11:26:33-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "aux_dry_bell_time",
          "value": "0.5",
          "tag": "uah_config",
          "update_time": "2026-07-12T11:26:33-05:00",
          "create_time": "2026-07-12T11:26:33-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "ren_button_mode",
          "value": "push",
          "tag": "uah_config",
          "update_time": "2026-07-12T11:26:33-05:00",
          "create_time": "2026-07-12T11:26:33-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "input_ren_mode",
          "value": "no",
          "tag": "uah_config",
          "update_time": "2026-07-12T11:26:33-05:00",
          "create_time": "2026-07-12T11:26:33-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "input_rex_mode",
          "value": "no",
          "tag": "uah_config",
          "update_time": "2026-07-12T11:26:33-05:00",
          "create_time": "2026-07-12T11:26:33-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "dps_mode",
          "value": "no",
          "tag": "uah_config",
          "update_time": "2026-07-12T11:26:33-05:00",
          "create_time": "2026-07-12T11:26:33-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "port-mac-4",
          "value": "aa:bb:cc:00:00:03",
          "tag": "hub_action",
          "update_time": "2026-07-12T11:43:53-05:00",
          "create_time": "2024-07-09T12:25:12-05:00"
        },
        {

          "device_id": "aabbcc000001",
          "key": "ssh_password",
          "value": "REDACTED-00000004-xx",
          "tag": "credential",
          "update_time": "2026-08-01T00:00:00-05:00",
          "create_time": "2024-06-30T13:03:48-05:00"
        }
      ],
      "update": null,
      "update_manual": {

        "device_version_upgrade_status": {

          "completed": false,
          "is_waiting": false,
          "is_preparing": false,
          "is_upgrading": false,
          "upgrade_seconds": 0,
          "timed_out": false,
          "failed": false,
          "failure_reason": "",
          "is_downloading": false
        },
        "device_type": "",
        "from_version": "",
        "last_upgrade_start_time": null,
        "last_upgrade_success": null,
        "last_upgrade_failure_reason": "",
        "last_download_start_time": null,
        "last_download_success": null,
        "last_download_failure_reason": "",
        "downloaded": false
      },
      "capabilities": [
        "unlock_failure_limit",
        "emergency_settings",
        "user_access_control",
        "visitor_access_control",
        "schedule_v1",
        "unlock_schedule",
        "incremental_update_user_token",
        "support_upgrade_by_url",
        "support_reboot",
        "first_person_in",
        "pin_code",
        "is_hub",
        "identity_is_hub",
        "dps_alarm",
        "input_mode_switch",
        "aux_alarm",
        "aux_delay_time",
        "hold_time_0.1s",
        "lock_relay_report",
        "ssh_change",
        "door_bell",
        "multi_unlock_schedule",
        "support_ui_account",
        "aux_option_change",
        "unlock_time_period",
        "incremental_update_setting",
        "incremental_update_credentials",
        "mqtt_topic_update_setting",
        "support_lpr_unlock",
        "mobile_unlock_ver2",
        "report_viewer_id",
        "two_factor_auth",
        "nfc_card_easy_provision",
        "power_state",
        "double_badge",
        "unlock_suspend",
        "location_state",
        "any_auth_type"
      ],
      "resource_name": "Test Name 14",
      "display_model": "UA Hub",
      "revision": "1785876758583455467",
      "revision_update_time": 1785876788,
      "version_update_time": -62135596800,
      "firmware_update_time": -62135596800,
      "adopt_time": 1719770628,
      "cameras": [
        {

          "mac": "AABBCC000002",
          "ip": "192.0.2.3",
          "name": "Test Name 15",
          "status": "online",
          "firmwareStatus": "upToDate",
          "firmware": "1.14.17.0",
          "startupTime": 1784045238000,
          "model": "UA G2 PRO",
          "shortname": "Test shortname 16",
          "isManaged": true,
          "isAdopted": true,
          "isConnected": true,
          "isAdoptedByAccessApp": true,
          "metadata": {

            "deviceType": "camera",
            "uniqueId": "000000000000000000000002"
          },
          "guid": "00000000-0000-0000-0000-000000000008",
          "source": "protect",
          "uniqueId": "000000000000000000000002",
          "type": "UA G2 PRO",
          "supportLicensePlate": false,
          "supportDetectLPOnly": false,
          "videoWidth": 1200,
          "videoHeight": 1600,
          "videoCodec": "h264",
          "lastSeen": 1786606200097,
          "hubMac": "",
          "smartDetectZones": [
            {

              "id": 10001,
              "name": "Test Name 17",
              "color": "#AB46BC",
              "points": [
                [
                  0,
                  0
                ],
                [
                  1,
                  0
                ],
                [
                  1,
                  1
                ],
                [
                  0,
                  1
                ]
              ],
              "sensitivity": 50,
              "objectTypes": [
                "person",
                "vehicle",
                "animal",
                "face",
                "licensePlate"
              ],
              "isTriggerLightEnabled": true,
              "triggerAccessTypes": [],
              "source": "unifi-access",
              "enableAccessLPOnlyMode": false
            }
          ],
          "allSmartDetectZones": [],
          "smartDetectSettings": {

            "objectTypes": [],
            "autoTrackingObjectTypes": [],
            "autoTrackingWithZoom": true,
            "audioTypes": [],
            "enableTamperDetection": false,
            "detectionRange": {

              "max": 0,
              "min": 0
            }
          },
          "supportDoorAccessConfig": false,
          "recordingSettings": {

            "mode": "never",
            "prePaddingSecs": 5,
            "postPaddingSecs": 5,
            "smartDetectPrePaddingSecs": 2,
            "smartDetectPostPaddingSecs": 2,
            "minMotionEventTrigger": 1000,
            "endMotionEventDelay": 3000,
            "suppressIlluminationSurge": false,
            "inScheduleMode": "always",
            "outScheduleMode": "never",
            "geofencing": "off",
            "motionAlgorithm": "enhanced",
            "enableMotionDetection": false,
            "createAccessEvent": true,
            "useNewMotionAlgorithm": true
          },
          "osdSettings": {

            "isNameEnabled": false,
            "isDateEnabled": false,
            "isLogoEnabled": false,
            "isDebugEnabled": false
          },
          "micVolume": 100,
          "isMicEnabled": true,
          "talkbackSettings": {

            "bindAddr": "",
            "bindPort": 8182,
            "bitsPerSample": 16,
            "channels": 1,
            "filterAddr": "",
            "filterPort": 0,
            "quality": 0,
            "samplingRate": 48000,
            "typeFmt": "aac",
            "typeIn": ""
          },
          "hasSpeaker": true,
          "isWaterproofCaseAttached": false,
          "ispSettings": {

            "aeMode": "auto",
            "irLedMode": "auto",
            "irLedLevel": 255,
            "wdr": 1,
            "icrSensitivity": 0,
            "icrSwitchMode": "sensitivity",
            "icrCustomValue": 2,
            "brightness": 50,
            "contrast": 50,
            "hue": 50,
            "saturation": 50,
            "sharpness": 50,
            "denoise": 50,
            "isColorNightVisionEnabled": false,
            "spotlightDuration": 15,
            "isFlippedVertical": false,
            "isFlippedHorizontal": false,
            "isAutoRotateEnabled": false,
            "isLdcEnabled": true,
            "is3dnrEnabled": true,
            "isExternalIrEnabled": false,
            "isAggressiveAntiFlickerEnabled": false,
            "isPauseMotionEnabled": false,
            "dZoomCenterX": 50,
            "dZoomCenterY": 50,
            "dZoomScale": 0,
            "dZoomStreamId": 4,
            "focusPosition": 0,
            "touchFocusX": 0,
            "touchFocusY": 0,
            "zoomPosition": 0,
            "mountPosition": null,
            "hdrMode": "normal",
            "sceneMode": "auto",
            "isSmokeCoverModeEnabled": false
          },
          "isPoorNetwork": false,
          "featureFlags": {

            "smartDetectTypes": [],
            "supportDoorAccessConfig": false,
            "supportNfc": false,
            "supportLpOnly": false,
            "supportLpDetectionWithoutVehicle": false,
            "hasMic": true,
            "hasPackageCamera": false,
            "hasPackageZoneSupportForSecondaryLens": false,
            "canOpticalZoom": false,
            "hotPlug": {

              "audio": null
            },
            "reader": {

              "supportAccessMethods": [],
              "support2fa": false,
              "supportLocate": false,
              "supportDoorDirection": false,
              "supportCallerManager": false,
              "supportInterfaceDirectory": false,
              "supportGreetings": false,
              "supportShowInterfaceImage": false,
              "supportShowStatusBar": false,
              "supportShowHeading": false,
              "supportGateStop": false
            }
          },
          "currentResolution": "HD",
          "supportNfc": false,
          "supportTouchPass": false,
          "supportFaceUnlock": false,
          "supportBtButton": false,
          "supportBtTap": false,
          "supportQrCode": false,
          "supportPIN": false,
          "supportTwoStepAuth": false,
          "supportGreeting": false,
          "supportDirection": false,
          "supportCallerManager": false,
          "supportMobileUnlockV2": false,
          "supportCallerDirectory": false,
          "supportTwilioSip": false,
          "supportGateStop": false,
          "supportShowInterfaceImage": false,
          "supportShowStatusBar": false,
          "supportShowHeading": false,
          "isFloodlightTriggerEnabled": false,
          "stats": {

            "video": {

              "recordingStart": 0,
              "recordingEnd": 0,
              "recordingStartLQ": 0,
              "recordingEndLQ": 0
            }
          }
        }
      ],
      "model": "UA Hub",
      "images": {

        "xs": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-000000000067_25x25.png",
        "s": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-000000000067_32x32.png",
        "m": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-000000000067_51x51.png",
        "l": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-000000000067_64x64.png",
        "xl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-000000000067_101x101.png",
        "xxl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-000000000067_128x128.png",
        "base": "icons/00000000-0000-0000-0000-000000000067_257x257.png"
      },
      "template": null
    }
  },
  {

    "event": "access.data.device.update",
    "receiver_id": "",
    "event_object_id": "aabbcc000003",
    "save_to_history": false,
    "data": {

      "unique_id": "aabbcc000003",
      "name": "Test Name 20",
      "alias": "",
      "device_type": "UA-G2-MINI",
      "connected_uah_id": "aabbcc000001",
      "location_id": "00000000-0000-0000-0000-000000000006",
      "firmware": "v3.18.21.0",
      "version": "v3.18.21.0",
      "ip": "192.0.2.4",
      "mac": "aa:bb:cc:00:00:03",
      "hw_type": "GA",
      "start_time": 1783874602,
      "last_seen": 1785619578,
      "security_check": false,
      "source": "",
      "bom_rev": "",
      "guid": "00000000-0000-0000-0000-00000000000d",
      "need_advisory": false,
      "is_camera": false,
      "is_adopted": true,
      "is_managed": true,
      "is_connected": true,
      "is_online": true,
      "is_rebooting": false,
      "is_unavailable": false,
      "is_upgrade_blocked": false,
      "is_export_sf_blocked": false,
      "adopting": false,
      "location": {

        "unique_id": "00000000-0000-0000-0000-000000000006",
        "name": "Test Name 10",
        "up_id": "00000000-0000-0000-0000-000000000001",
        "timezone": "",
        "location_type": "door",
        "extra_type": "",
        "full_name": "Test Name 11",
        "level": 0,
        "work_time": "[]",
        "work_time_id": "",
        "extras": {

          "door_thumbnail": "REDACTED-0000001f-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
          "door_thumbnail_last_update": 1786606388,
          "uah-input_state_dps": "off",
          "uah-wiring_state_dps-neg": "off",
          "uah-wiring_state_dps-pos": "off"
        },
        "previous_name": null
      },
      "door": {

        "unique_id": "00000000-0000-0000-0000-000000000006",
        "name": "Test Name 10",
        "up_id": "00000000-0000-0000-0000-000000000001",
        "timezone": "",
        "location_type": "door",
        "extra_type": "",
        "full_name": "Test Name 11",
        "level": 0,
        "work_time": "[]",
        "work_time_id": "",
        "extras": {

          "door_thumbnail": "REDACTED-0000001f-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
          "door_thumbnail_last_update": 1786606388,
          "uah-input_state_dps": "off",
          "uah-wiring_state_dps-neg": "off",
          "uah-wiring_state_dps-pos": "off"
        },
        "previous_name": null
      },
      "floor": {

        "unique_id": "00000000-0000-0000-0000-000000000001",
        "name": "Test Name 2",
        "up_id": "00000000-0000-0000-0000-000000000000",
        "timezone": "",
        "location_type": "floor",
        "extra_type": "",
        "full_name": "Test Name 3",
        "level": 1,
        "work_time": "[]",
        "work_time_id": "",
        "extras": {},
        "previous_name": null
      },
      "configs": [
        {

          "device_id": "aabbcc000003",
          "key": "nacl_private_key",
          "value": "REDACTED-0000000b-xxxxxxxxxxxxxxxxxxxxxxxxxx",
          "tag": "credential",
          "update_time": "2026-03-10T13:25:43-05:00",
          "create_time": "2026-03-10T08:25:43-05:00"
        },
        {

          "device_id": "aabbcc000003",
          "key": "ssh_user",
          "value": "Test username 8",
          "tag": "credential",
          "update_time": "2025-11-10T01:48:18-06:00",
          "create_time": "2025-11-09T19:48:18-06:00"
        },
        {

          "device_id": "aabbcc000003",
          "key": "cert_fingerprint",
          "value": "0000000000000000000000000000000000000004",
          "tag": "credential",
          "update_time": "2025-11-10T01:48:18-06:00",
          "create_time": "2025-11-09T19:48:18-06:00"
        },
        {

          "device_id": "aabbcc000003",
          "key": "apple_pass",
          "value": "no",
          "tag": "open_door_mode",
          "update_time": "2025-11-10T01:48:18-06:00",
          "create_time": "2025-11-09T19:48:18-06:00"
        },
        {

          "device_id": "aabbcc000003",
          "key": "door_entry_method",
          "value": "out",
          "tag": "door_entry_method",
          "update_time": "2025-11-10T01:48:18-06:00",
          "create_time": "2025-11-09T19:48:18-06:00"
        },
        {

          "device_id": "aabbcc000003",
          "key": "greeting_text",
          "value": "see_you",
          "tag": "device_setting",
          "update_time": "2025-11-10T01:48:18-06:00",
          "create_time": "2025-11-09T19:48:18-06:00"
        },
        {

          "device_id": "aabbcc000003",
          "key": "show_entry_greet",
          "value": "yes",
          "tag": "device_setting",
          "update_time": "2025-11-10T01:48:18-06:00",
          "create_time": "2025-11-09T19:48:18-06:00"
        },
        {

          "device_id": "aabbcc000003",
          "key": "greeting_broadcast_name",
          "value": "none",
          "tag": "device_setting",
          "update_time": "2025-11-10T01:48:18-06:00",
          "create_time": "2025-11-09T19:48:18-06:00"
        },
        {

          "device_id": "aabbcc000003",
          "key": "ps_sensitivity",
          "value": "0",
          "tag": "device_setting",
          "update_time": "2025-11-10T01:48:18-06:00",
          "create_time": "2025-11-09T19:48:18-06:00"
        },
        {

          "device_id": "aabbcc000003",
          "key": "volume",
          "value": "yes",
          "tag": "device_setting",
          "update_time": "2025-11-10T01:48:18-06:00",
          "create_time": "2025-11-09T19:48:18-06:00"
        },
        {

          "device_id": "aabbcc000003",
          "key": "alias",
          "value": "",
          "tag": "device_extra",
          "update_time": "2025-11-10T01:48:18-06:00",
          "create_time": "2025-11-09T19:48:18-06:00"
        },
        {

          "device_id": "aabbcc000003",
          "key": "nacl_public_key",
          "value": "REDACTED-0000000c-xxxxxxxxxxxxxxxxxxxxxxxxxx",
          "tag": "credential",
          "update_time": "2025-11-10T01:48:19-06:00",
          "create_time": "2025-11-09T19:48:19-06:00"
        },
        {

          "device_id": "aabbcc000003",
          "key": "mobile_unlock_ver2",
          "value": "yes",
          "tag": "device_setting",
          "update_time": "2025-11-10T01:48:19-06:00",
          "create_time": "2025-11-09T19:48:19-06:00"
        },
        {

          "device_id": "aabbcc000003",
          "key": "ibeacon_uuid",
          "value": "00000000-0000-0000-0000-000000000004",
          "tag": "device_setting",
          "update_time": "2025-11-10T01:48:19-06:00",
          "create_time": "2025-11-09T19:48:19-06:00"
        },
        {

          "device_id": "aabbcc000003",
          "key": "ibeacon_major",
          "value": "0",
          "tag": "device_setting",
          "update_time": "2025-11-10T01:48:19-06:00",
          "create_time": "2025-11-09T19:48:19-06:00"
        },
        {

          "device_id": "aabbcc000003",
          "key": "ibeacon_minor",
          "value": "1",
          "tag": "device_setting",
          "update_time": "2025-11-10T01:48:19-06:00",
          "create_time": "2025-11-09T19:48:19-06:00"
        },
        {

          "device_id": "aabbcc000003",
          "key": "bt",
          "value": "yes",
          "tag": "open_door_mode",
          "update_time": "2025-11-10T01:48:19-06:00",
          "create_time": "2025-11-09T19:48:19-06:00"
        },
        {

          "device_id": "aabbcc000003",
          "key": "bt_button",
          "value": "yes",
          "tag": "open_door_mode",
          "update_time": "2025-11-10T01:55:05-06:00",
          "create_time": "2025-11-09T19:48:19-06:00"
        },
        {

          "device_id": "aabbcc000003",
          "key": "bt_tap",
          "value": "yes",
          "tag": "open_door_mode",
          "update_time": "2025-11-10T01:55:18-06:00",
          "create_time": "2025-11-09T19:48:19-06:00"
        },
        {

          "device_id": "aabbcc000003",
          "key": "wave",
          "value": "yes",
          "tag": "open_door_mode",
          "update_time": "2025-11-10T01:52:58-06:00",
          "create_time": "2025-11-09T19:48:18-06:00"
        },
        {

          "device_id": "aabbcc000003",
          "key": "nfc",
          "value": "yes",
          "tag": "open_door_mode",
          "update_time": "2025-11-10T01:54:17-06:00",
          "create_time": "2025-11-09T19:48:18-06:00"
        },
        {

          "device_id": "aabbcc000003",
          "key": "ssh_password",
          "value": "REDACTED-0000000d-xx",
          "tag": "credential",
          "update_time": "2026-08-01T00:00:05-05:00",
          "create_time": "2025-11-09T19:48:18-06:00"
        }
      ],
      "update": null,
      "update_manual": {

        "device_version_upgrade_status": {

          "completed": false,
          "is_waiting": false,
          "is_preparing": false,
          "is_upgrading": false,
          "upgrade_seconds": 0,
          "timed_out": false,
          "failed": false,
          "failure_reason": "",
          "is_downloading": false
        },
        "device_type": "",
        "from_version": "",
        "last_upgrade_start_time": null,
        "last_upgrade_success": null,
        "last_upgrade_failure_reason": "",
        "last_download_start_time": null,
        "last_download_success": null,
        "last_download_failure_reason": "",
        "downloaded": false
      },
      "capabilities": [
        "ssh_change",
        "support_register_card",
        "is_reader",
        "identity_is_reader",
        "adopt_under_console",
        "support_upgrade_by_url",
        "support_greeting",
        "hand_wave",
        "support_ui_account",
        "sensitivity",
        "mobile_unlock_ver2",
        "support_reboot",
        "nfc_card_easy_provision",
        "incremental_update_setting",
        "identity_unlock_control_cmd"
      ],
      "resource_name": "Test Name 21",
      "display_model": "UA G2",
      "revision": "1785876758583455467",
      "revision_update_time": 1785876788,
      "version_update_time": -62135596800,
      "firmware_update_time": -62135596800,
      "adopt_time": 1762739298,
      "model": "UA G2 Black",
      "images": {

        "xs": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-000000000069_25x25.png",
        "s": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-000000000069_32x32.png",
        "m": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-000000000069_51x51.png",
        "l": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-000000000069_64x64.png",
        "xl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-000000000069_101x101.png",
        "xxl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-000000000069_128x128.png",
        "base": "icons/00000000-0000-0000-0000-000000000069_257x257.png",
        "animation": [
          "icons/g2-mini-black-close.png",
          "icons/g2-mini-black-open.png"
        ]
      },
      "template": null
    }
  },
  {

    "event": "access.data.device.update",
    "receiver_id": "",
    "event_object_id": "aabbcc000002",
    "save_to_history": false,
    "data": {

      "unique_id": "aabbcc000002",
      "name": "Test Name 68",
      "alias": "",
      "device_type": "UA-G2-PRO",
      "connected_uah_id": "aabbcc000001",
      "location_id": "00000000-0000-0000-0000-000000000006",
      "firmware": "v1.14.17.0",
      "version": "v3.14.4552",
      "ip": "192.0.2.3",
      "mac": "aa:bb:cc:00:00:02",
      "hw_type": "GA",
      "start_time": 1784045238,
      "last_seen": 1785619578,
      "security_check": true,
      "source": "",
      "bom_rev": "01",
      "guid": "00000000-0000-0000-0000-000000000009",
      "need_advisory": false,
      "is_camera": false,
      "is_adopted": true,
      "is_managed": true,
      "is_connected": true,
      "is_online": true,
      "is_rebooting": false,
      "is_unavailable": false,
      "is_upgrade_blocked": false,
      "is_export_sf_blocked": false,
      "adopting": false,
      "location": {

        "unique_id": "00000000-0000-0000-0000-000000000006",
        "name": "Test Name 10",
        "up_id": "00000000-0000-0000-0000-000000000001",
        "timezone": "",
        "location_type": "door",
        "extra_type": "",
        "full_name": "Test Name 11",
        "level": 0,
        "work_time": "[]",
        "work_time_id": "",
        "extras": {

          "door_thumbnail": "REDACTED-0000001f-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
          "door_thumbnail_last_update": 1786606388,
          "uah-input_state_dps": "off",
          "uah-wiring_state_dps-neg": "off",
          "uah-wiring_state_dps-pos": "off"
        },
        "previous_name": null
      },
      "door": {

        "unique_id": "00000000-0000-0000-0000-000000000006",
        "name": "Test Name 10",
        "up_id": "00000000-0000-0000-0000-000000000001",
        "timezone": "",
        "location_type": "door",
        "extra_type": "",
        "full_name": "Test Name 11",
        "level": 0,
        "work_time": "[]",
        "work_time_id": "",
        "extras": {

          "door_thumbnail": "REDACTED-0000001f-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
          "door_thumbnail_last_update": 1786606388,
          "uah-input_state_dps": "off",
          "uah-wiring_state_dps-neg": "off",
          "uah-wiring_state_dps-pos": "off"
        },
        "previous_name": null
      },
      "floor": {

        "unique_id": "00000000-0000-0000-0000-000000000001",
        "name": "Test Name 2",
        "up_id": "00000000-0000-0000-0000-000000000000",
        "timezone": "",
        "location_type": "floor",
        "extra_type": "",
        "full_name": "Test Name 3",
        "level": 1,
        "work_time": "[]",
        "work_time_id": "",
        "extras": {},
        "previous_name": null
      },
      "configs": [
        {

          "device_id": "aabbcc000002",
          "key": "ssh_user",
          "value": "Test username 8",
          "tag": "credential",
          "update_time": "2024-06-30T18:03:49-05:00",
          "create_time": "2024-06-30T13:03:49-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "cert_fingerprint",
          "value": "0000000000000000000000000000000000000003",
          "tag": "credential",
          "update_time": "2024-06-30T18:03:49-05:00",
          "create_time": "2024-06-30T13:03:49-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "door_entry_method",
          "value": "in",
          "tag": "door_entry_method",
          "update_time": "2024-06-30T18:03:49-05:00",
          "create_time": "2024-06-30T13:03:49-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "capture_record_extra_before",
          "value": "5",
          "tag": "device_setting",
          "update_time": "2024-06-30T18:03:49-05:00",
          "create_time": "2024-06-30T13:03:49-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "capture_record_extra_after",
          "value": "5",
          "tag": "device_setting",
          "update_time": "2024-06-30T18:03:49-05:00",
          "create_time": "2024-06-30T13:03:49-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "alias",
          "value": "",
          "tag": "device_extra",
          "update_time": "2024-06-30T18:03:49-05:00",
          "create_time": "2024-06-30T13:03:49-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "nacl_public_key",
          "value": "REDACTED-00000007-xxxxxxxxxxxxxxxxxxxxxxxxxx",
          "tag": "credential",
          "update_time": "2024-06-30T18:03:49-05:00",
          "create_time": "2024-06-30T13:03:49-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "nfc",
          "value": "yes",
          "tag": "open_door_mode",
          "update_time": "2026-01-24T03:15:48-06:00",
          "create_time": "2024-06-30T13:03:49-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "nacl_private_key",
          "value": "REDACTED-00000006-xxxxxxxxxxxxxxxxxxxxxxxxxx",
          "tag": "credential",
          "update_time": "2026-02-10T15:44:17-06:00",
          "create_time": "2026-02-10T09:44:17-06:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "bt_button",
          "value": "yes",
          "tag": "open_door_mode",
          "update_time": "2026-01-24T02:41:01-06:00",
          "create_time": "2024-06-30T13:03:49-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "tof_distance",
          "value": "2000",
          "tag": "device_setting",
          "update_time": "2024-06-30T18:03:50-05:00",
          "create_time": "2024-06-30T13:03:50-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "volume",
          "value": "36",
          "tag": "device_setting",
          "update_time": "2024-06-30T18:03:50-05:00",
          "create_time": "2024-06-30T13:03:50-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "brightness",
          "value": "36",
          "tag": "device_setting",
          "update_time": "2024-06-30T18:03:50-05:00",
          "create_time": "2024-06-30T13:03:50-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "greeting_text",
          "value": "welcome",
          "tag": "device_setting",
          "update_time": "2024-06-30T18:03:50-05:00",
          "create_time": "2024-06-30T13:03:50-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "greeting_broadcast_name",
          "value": "first_name_only",
          "tag": "device_setting",
          "update_time": "2024-06-30T18:03:50-05:00",
          "create_time": "2024-06-30T13:03:50-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "pin_code_shuffle",
          "value": "no",
          "tag": "device_setting",
          "update_time": "2024-06-30T18:03:50-05:00",
          "create_time": "2024-06-30T13:03:50-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "door_bell_trigger_interface",
          "value": "swipe",
          "tag": "device_setting",
          "update_time": "2024-06-30T18:03:50-05:00",
          "create_time": "2024-06-30T13:03:50-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "pin_code",
          "value": "REDACTED-00000008-",
          "tag": "open_door_mode",
          "update_time": "2025-11-10T01:14:50-06:00",
          "create_time": "2024-06-30T13:03:49-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "ibeacon_uuid",
          "value": "00000000-0000-0000-0000-000000000004",
          "tag": "device_setting",
          "update_time": "2024-09-06T04:16:42-05:00",
          "create_time": "2024-06-30T13:03:49-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "ibeacon_major",
          "value": "0",
          "tag": "device_setting",
          "update_time": "2024-09-06T04:16:42-05:00",
          "create_time": "2024-06-30T13:03:49-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "ibeacon_minor",
          "value": "1",
          "tag": "device_setting",
          "update_time": "2024-09-06T04:16:42-05:00",
          "create_time": "2024-06-30T13:03:49-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "bt",
          "value": "yes",
          "tag": "open_door_mode",
          "update_time": "2024-09-06T04:16:42-05:00",
          "create_time": "2024-06-30T13:03:49-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "pin_code_disable",
          "value": "no",
          "tag": "device_setting",
          "update_time": "2024-06-30T18:07:02-05:00",
          "create_time": "2024-06-30T13:07:02-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "mobile_unlock_ver2",
          "value": "yes",
          "tag": "device_setting",
          "update_time": "2024-12-07T01:06:22-06:00",
          "create_time": "2024-12-06T19:06:22-06:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "capture_enable",
          "value": "no",
          "tag": "device_setting",
          "update_time": "2025-01-28T15:24:16-06:00",
          "create_time": "2025-01-28T09:24:16-06:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "disable_recording_default",
          "value": "yes",
          "tag": "device_setting",
          "update_time": "2025-01-17T16:57:19-06:00",
          "create_time": "2025-01-17T10:57:19-06:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "bt_tap",
          "value": "yes",
          "tag": "open_door_mode",
          "update_time": "2026-01-24T02:41:01-06:00",
          "create_time": "2025-03-29T15:50:00-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "call_volume",
          "value": "80",
          "tag": "device_setting",
          "update_time": "2025-01-28T13:52:43-06:00",
          "create_time": "2025-01-28T07:52:43-06:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "show_entry_greet",
          "value": "yes",
          "tag": "device_setting",
          "update_time": "2025-03-10T20:40:51-05:00",
          "create_time": "2025-03-10T15:40:51-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "show_unlock_schedule",
          "value": "yes",
          "tag": "device_setting",
          "update_time": "2025-03-10T20:41:01-05:00",
          "create_time": "2025-03-10T15:41:01-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "qr_code",
          "value": "yes",
          "tag": "open_door_mode",
          "update_time": "2025-11-09T20:37:39-06:00",
          "create_time": "2025-01-28T07:52:44-06:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "face_detect_distance",
          "value": "near",
          "tag": "device_setting",
          "update_time": "2026-01-24T03:15:54-06:00",
          "create_time": "2025-09-13T11:30:00-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "apple_pass",
          "value": "no",
          "tag": "open_door_mode",
          "update_time": "2025-07-16T13:49:37-05:00",
          "create_time": "2025-07-16T08:49:37-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "face_anti_spoofing_level",
          "value": "high",
          "tag": "device_setting",
          "update_time": "2026-01-24T03:15:54-06:00",
          "create_time": "2025-09-13T11:19:58-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "face",
          "value": "yes",
          "tag": "open_door_mode",
          "update_time": "2026-01-24T03:15:58-06:00",
          "create_time": "2025-09-13T11:19:58-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "welcome_led",
          "value": "yes",
          "tag": "device_setting",
          "update_time": "2026-07-12T11:26:33-05:00",
          "create_time": "2026-07-12T11:26:33-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "capture_tof_enable",
          "value": "yes",
          "tag": "device_setting",
          "update_time": "2026-07-12T11:26:33-05:00",
          "create_time": "2026-07-12T11:26:33-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "show_auth_method",
          "value": "yes",
          "tag": "device_setting",
          "update_time": "2026-07-12T11:26:33-05:00",
          "create_time": "2026-07-12T11:26:33-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "status_led",
          "value": "yes",
          "tag": "device_setting",
          "update_time": "2026-07-12T11:26:33-05:00",
          "create_time": "2026-07-12T11:26:33-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "door_bell_trigger_type",
          "value": "on",
          "tag": "device_setting",
          "update_time": "2026-07-12T11:26:33-05:00",
          "create_time": "2026-07-12T11:26:33-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "ssh_password",
          "value": "REDACTED-0000000a-xx",
          "tag": "credential",
          "update_time": "2026-08-01T00:00:00-05:00",
          "create_time": "2024-06-30T13:03:49-05:00"
        },
        {

          "device_id": "aabbcc000002",
          "key": "preview",
          "value": "REDACTED-00000020-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
          "tag": "device_extra",
          "update_time": "2026-08-13T02:33:08-05:00",
          "create_time": "2024-06-30T13:03:51-05:00"
        }
      ],
      "update": null,
      "update_manual": {

        "device_version_upgrade_status": {

          "completed": false,
          "is_waiting": false,
          "is_preparing": false,
          "is_upgrading": false,
          "upgrade_seconds": 0,
          "timed_out": false,
          "failed": false,
          "failure_reason": "",
          "is_downloading": false
        },
        "device_type": "",
        "from_version": "",
        "last_upgrade_start_time": null,
        "last_upgrade_success": null,
        "last_upgrade_failure_reason": "",
        "last_download_start_time": null,
        "last_download_success": null,
        "last_download_failure_reason": "",
        "downloaded": false
      },
      "capabilities": [
        "pin_code",
        "pin_code_length",
        "change_setting",
        "remote_view",
        "remote_call",
        "ssh_change",
        "support_register_card",
        "is_reader",
        "identity_is_reader",
        "identity_remote_view",
        "support_reboot",
        "support_greeting",
        "support_greeting_message",
        "support_salutation",
        "keypad_layout",
        "support_ui_account",
        "support_webrtc",
        "identity_support_webrtc",
        "support_uid_webrtc",
        "support_upgrade_by_url",
        "support_record_extra",
        "doorbell_timeout",
        "doorbell_bind",
        "post_capture",
        "hold_to_call",
        "support_face",
        "identity_face_unlock",
        "mobile_unlock_ver2",
        "adopt_under_console",
        "support_ems",
        "identity_support_ems",
        "anti_spoofing_level",
        "show_face_method",
        "support_faceme_sdk",
        "support_twilio_sip",
        "qr_code",
        "support_record_hq_stream",
        "report_audio_setting",
        "support_interface_design",
        "support_generic_resource_key",
        "show_unlock_schedule",
        "video_overlay",
        "two_factor_auth",
        "support_face_sensitivity",
        "support_third_party_sip",
        "nfc_card_easy_provision",
        "mic_management",
        "screen_off_timeout",
        "support_sip_tls",
        "identity_unlock_control_cmd",
        "double_badge"
      ],
      "resource_name": "Test Name 19",
      "display_model": "UA G2 Pro",
      "revision": "1785876758583455467",
      "revision_update_time": 1785876788,
      "version_update_time": -62135596800,
      "firmware_update_time": -62135596800,
      "adopt_time": 1719770629,
      "extensions": [
        {

          "unique_id": "00000000-0000-0000-0000-00000000000a",
          "device_id": "aabbcc000002",
          "extension_name": "intercom_pair",
          "target_type": "admin",
          "target_config": [
            {

              "config_tag": "",
              "config_key": "",
              "config_value": "00000000-0000-0000-0000-00000000000b"
            },
            {

              "config_tag": "",
              "config_key": "",
              "config_value": "00000000-0000-0000-0000-00000000000c"
            }
          ]
        }
      ],
      "model": "UA G2 Pro",
      "images": {

        "xs": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006a_25x25.png",
        "s": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006a_32x32.png",
        "m": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006a_51x51.png",
        "l": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006a_64x64.png",
        "xl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006a_101x101.png",
        "xxl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006a_128x128.png",
        "base": "icons/00000000-0000-0000-0000-00000000006a_257x257.png",
        "animation": [
          "icons/g2-pro-black-close.png",
          "icons/g2-pro-black-open.png"
        ]
      },
      "camera_setting": {

        "cameraId": "000000000000000000000002",
        "recordingSettings": {

          "mode": "never",
          "prePaddingSecs": 5,
          "postPaddingSecs": 5,
          "smartDetectPrePaddingSecs": 2,
          "smartDetectPostPaddingSecs": 2,
          "minMotionEventTrigger": 1000,
          "endMotionEventDelay": 3000,
          "suppressIlluminationSurge": false,
          "inScheduleMode": "always",
          "outScheduleMode": "never",
          "geofencing": "off",
          "motionAlgorithm": "enhanced",
          "enableMotionDetection": false,
          "createAccessEvent": true,
          "useNewMotionAlgorithm": true
        },
        "osdSettings": {

          "isNameEnabled": false,
          "isDateEnabled": false,
          "isLogoEnabled": false,
          "isDebugEnabled": false
        },
        "micVolume": 100,
        "isMicEnabled": true
      },
      "template": null
    }
  },
  {

    "event": "access.data.camera.update",
    "receiver_id": "",
    "event_object_id": "00000000000000000000000c",
    "save_to_history": false,
    "data": {

      "mac": "AABBCC000010",
      "ip": "192.0.2.13",
      "name": "Test Name 65",
      "status": "online",
      "firmwareStatus": "upToDate",
      "firmware": "5.3.95",
      "startupTime": 1782282073017,
      "model": "G6 Pro Entry",
      "shortname": "Test shortname 66",
      "isManaged": true,
      "isAdopted": true,
      "isConnected": true,
      "metadata": {

        "deviceType": "camera",
        "uniqueId": "00000000000000000000000c"
      },
      "guid": "00000000-0000-0000-0000-000000000034",
      "images": {

        "xs": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_25x25.png",
        "s": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_32x32.png",
        "m": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_51x51.png",
        "l": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_64x64.png",
        "xl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_101x101.png",
        "xxl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_128x128.png",
        "animation": [
          "icons/g6-pro-entry-close.png",
          "icons/g6-pro-entry-open.png"
        ]
      },
      "source": "protect",
      "uniqueId": "00000000000000000000000c",
      "type": "UVC G6 Pro Entry",
      "supportLicensePlate": true,
      "supportDetectLPOnly": true,
      "videoWidth": 3024,
      "videoHeight": 4096,
      "videoCodec": "h265",
      "lastSeen": 1786606385017,
      "hubMac": "",
      "smartDetectZones": [
        {

          "id": 10001,
          "name": "Test Name 17",
          "color": "#AB46BC",
          "points": [
            [
              0,
              0
            ],
            [
              1,
              0
            ],
            [
              1,
              1
            ],
            [
              0,
              1
            ]
          ],
          "sensitivity": 50,
          "objectTypes": [
            "person",
            "vehicle",
            "animal",
            "face",
            "licensePlate"
          ],
          "isTriggerLightEnabled": true,
          "triggerAccessTypes": [],
          "source": "unifi-access",
          "enableAccessLPOnlyMode": false
        }
      ],
      "allSmartDetectZones": [
        {

          "id": 1,
          "name": "Test Name 67",
          "color": "#AB46BC",
          "points": [
            [
              0,
              0
            ],
            [
              1,
              0
            ],
            [
              1,
              1
            ],
            [
              0,
              1
            ]
          ],
          "sensitivity": 50,
          "objectTypes": [
            "person",
            "vehicle",
            "animal",
            "face"
          ],
          "isTriggerLightEnabled": true,
          "triggerAccessTypes": [],
          "source": "unifi-protect",
          "enableAccessLPOnlyMode": false
        }
      ],
      "smartDetectSettings": {

        "objectTypes": [
          "person",
          "vehicle",
          "animal",
          "package",
          "face",
          "licensePlate"
        ],
        "autoTrackingObjectTypes": [],
        "autoTrackingWithZoom": true,
        "audioTypes": [
          "alrmSmoke",
          "alrmCmonx",
          "alrmSiren",
          "alrmBabyCry",
          "alrmSpeak",
          "alrmBurglar",
          "alrmCarHorn",
          "alrmBark",
          "alrmGlassBreak"
        ],
        "enableTamperDetection": false,
        "detectionRange": {

          "max": 0,
          "min": 0
        }
      },
      "supportDoorAccessConfig": true,
      "recordingSettings": {

        "mode": "always",
        "prePaddingSecs": 2,
        "postPaddingSecs": 2,
        "smartDetectPrePaddingSecs": 2,
        "smartDetectPostPaddingSecs": 2,
        "minMotionEventTrigger": 1000,
        "endMotionEventDelay": 3000,
        "suppressIlluminationSurge": false,
        "inScheduleMode": "always",
        "outScheduleMode": "never",
        "geofencing": "off",
        "motionAlgorithm": "enhanced",
        "enableMotionDetection": false,
        "createAccessEvent": true,
        "useNewMotionAlgorithm": true
      },
      "osdSettings": {

        "isNameEnabled": false,
        "isDateEnabled": true,
        "isLogoEnabled": false,
        "isDebugEnabled": false
      },
      "micVolume": 100,
      "isMicEnabled": true,
      "talkbackSettings": {

        "bindAddr": "192.0.2.14",
        "bindPort": 7004,
        "bitsPerSample": 16,
        "channels": 1,
        "filterAddr": "",
        "filterPort": 0,
        "quality": 100,
        "samplingRate": 22050,
        "typeFmt": "aac",
        "typeIn": "serverudp"
      },
      "hasSpeaker": true,
      "isWaterproofCaseAttached": false,
      "ispSettings": {

        "aeMode": "auto",
        "irLedMode": "auto",
        "irLedLevel": 255,
        "wdr": 1,
        "icrSensitivity": 0,
        "icrSwitchMode": "sensitivity",
        "icrCustomValue": 1,
        "brightness": 50,
        "contrast": 50,
        "hue": 50,
        "saturation": 50,
        "sharpness": 50,
        "denoise": 50,
        "isColorNightVisionEnabled": true,
        "spotlightDuration": 15,
        "isFlippedVertical": false,
        "isFlippedHorizontal": false,
        "isAutoRotateEnabled": false,
        "isLdcEnabled": true,
        "is3dnrEnabled": true,
        "isExternalIrEnabled": false,
        "isAggressiveAntiFlickerEnabled": false,
        "isPauseMotionEnabled": false,
        "dZoomCenterX": 50,
        "dZoomCenterY": 50,
        "dZoomScale": 0,
        "dZoomStreamId": 4,
        "focusPosition": 0,
        "touchFocusX": 1001,
        "touchFocusY": 1001,
        "zoomPosition": 0,
        "mountPosition": "ceiling",
        "hdrMode": "normal",
        "sceneMode": "auto",
        "isSmokeCoverModeEnabled": false
      },
      "isPoorNetwork": false,
      "featureFlags": {

        "smartDetectTypes": [
          "person",
          "vehicle",
          "animal",
          "package",
          "face",
          "licensePlate"
        ],
        "supportDoorAccessConfig": true,
        "supportNfc": false,
        "supportLpOnly": false,
        "supportLpDetectionWithoutVehicle": true,
        "hasMic": true,
        "hasPackageCamera": true,
        "hasPackageZoneSupportForSecondaryLens": true,
        "canOpticalZoom": false,
        "hotPlug": {

          "audio": null
        },
        "reader": {

          "supportAccessMethods": [
            "nfc",
            "touchPass",
            "pinCode",
            "btButton",
            "btTap",
            "face",
            "qrCode"
          ],
          "support2fa": false,
          "supportLocate": true,
          "supportDoorDirection": true,
          "supportCallerManager": true,
          "supportInterfaceDirectory": true,
          "supportGreetings": true,
          "supportShowInterfaceImage": true,
          "supportShowStatusBar": true,
          "supportShowHeading": true,
          "supportGateStop": true
        }
      },
      "currentResolution": "5K",
      "supportNfc": true,
      "supportTouchPass": true,
      "supportFaceUnlock": true,
      "supportBtButton": true,
      "supportBtTap": true,
      "supportQrCode": true,
      "supportPIN": true,
      "supportTwoStepAuth": false,
      "supportGreeting": true,
      "supportDirection": false,
      "supportCallerManager": true,
      "supportMobileUnlockV2": true,
      "supportCallerDirectory": true,
      "supportTwilioSip": false,
      "supportGateStop": true,
      "supportShowInterfaceImage": true,
      "supportShowStatusBar": true,
      "supportShowHeading": true,
      "isFloodlightTriggerEnabled": false,
      "stats": {

        "video": {

          "recordingStart": 1784220871786,
          "recordingEnd": 1786606383001,
          "recordingStartLQ": 1784210492601,
          "recordingEndLQ": 1786606383012
        }
      },
      "location": [],
      "configs": [
        {

          "device_id": "00000000000000000000000c",
          "key": "capture_enable",
          "value": "yes",
          "tag": "device_extra",
          "update_time": "0001-01-01T00:00:00Z",
          "create_time": "0001-01-01T00:00:00Z"
        },
        {

          "device_id": "00000000000000000000000c",
          "key": "capture",
          "value": "yes",
          "tag": "device_extra",
          "update_time": "0001-01-01T00:00:00Z",
          "create_time": "0001-01-01T00:00:00Z"
        },
        {

          "device_id": "00000000000000000000000c",
          "key": "door_entry_method",
          "value": "in",
          "tag": "door_entry_method",
          "update_time": "0001-01-01T00:00:00Z",
          "create_time": "0001-01-01T00:00:00Z"
        }
      ],
      "support_feature": [
        "capture"
      ],
      "bind_same_paired": false,
      "accessDetectZones": [],
      "isAccessReader": false
    }
  },
  {

    "event": "access.data.device.update",
    "receiver_id": "",
    "event_object_id": "00000000000000000000000c",
    "save_to_history": false,
    "data": {

      "unique_id": "00000000000000000000000c",
      "name": "Test Name 65",
      "alias": "",
      "device_type": "UVC G6 Pro Entry",
      "connected_uah_id": "",
      "location_id": "",
      "firmware": "5.3.95",
      "version": "5.3.95",
      "ip": "192.0.2.13",
      "mac": "aa:bb:cc:00:00:10",
      "hw_type": "",
      "start_time": 1782282073,
      "last_seen": null,
      "security_check": null,
      "source": null,
      "bom_rev": null,
      "guid": "00000000-0000-0000-0000-000000000034",
      "need_advisory": null,
      "is_camera": true,
      "resource_name": "",
      "revision": null,
      "revision_update_time": null,
      "version_update_time": null,
      "firmware_update_time": null,
      "adopt_time": null,
      "location": null,
      "configs": [
        {

          "device_id": "00000000000000000000000c",
          "key": "capture_enable",
          "value": "yes",
          "tag": "device_extra",
          "update_time": "0001-01-01T00:00:00Z",
          "create_time": "0001-01-01T00:00:00Z"
        },
        {

          "device_id": "00000000000000000000000c",
          "key": "capture",
          "value": "yes",
          "tag": "device_extra",
          "update_time": "0001-01-01T00:00:00Z",
          "create_time": "0001-01-01T00:00:00Z"
        },
        {

          "device_id": "00000000000000000000000c",
          "key": "door_entry_method",
          "value": "in",
          "tag": "door_entry_method",
          "update_time": "0001-01-01T00:00:00Z",
          "create_time": "0001-01-01T00:00:00Z"
        }
      ],
      "is_connected": true,
      "is_online": true,
      "is_revision_up_to_date": false,
      "is_adopted": true,
      "is_managed": true,
      "is_upgrade_blocked": false,
      "is_export_sf_blocked": false,
      "is_rebooting": false,
      "update": null,
      "capabilities": [
        "support_register_card",
        "nfc_card_easy_provision",
        "support_mobile_unlock",
        "support_apple_pass",
        "show_face_method",
        "support_inhouse_sdk",
        "anti_spoofing_level",
        "support_face_sensitivity",
        "pin_code",
        "qr_code",
        "support_greeting",
        "support_caller_manager",
        "support_directory_direct",
        "support_show_interface_image",
        "support_show_status_bar",
        "support_show_heading",
        "identity_unlock_control_cmd",
        "support_ems",
        "doorbell_timeout",
        "doorbell_bind",
        "identity_support_ems",
        "identity_remote_view",
        "identity_face_unlock",
        "identity_is_camera",
        "support_record_hq_stream",
        "keypad_layout"
      ],
      "template": null,
      "images": {

        "xs": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_25x25.png",
        "s": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_32x32.png",
        "m": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_51x51.png",
        "l": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_64x64.png",
        "xl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_101x101.png",
        "xxl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_128x128.png",
        "animation": [
          "icons/g6-pro-entry-close.png",
          "icons/g6-pro-entry-open.png"
        ]
      },
      "camera_resource": {

        "mac": "AABBCC000010",
        "ip": "192.0.2.13",
        "name": "Test Name 65",
        "status": "online",
        "firmwareStatus": "upToDate",
        "firmware": "5.3.95",
        "startupTime": 1782282073017,
        "model": "G6 Pro Entry",
        "shortname": "Test shortname 66",
        "isManaged": true,
        "isAdopted": true,
        "isConnected": true,
        "metadata": {

          "deviceType": "camera",
          "uniqueId": "00000000000000000000000c"
        },
        "guid": "00000000-0000-0000-0000-000000000034",
        "images": {

          "xs": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_25x25.png",
          "s": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_32x32.png",
          "m": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_51x51.png",
          "l": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_64x64.png",
          "xl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_101x101.png",
          "xxl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_128x128.png",
          "animation": [
            "icons/g6-pro-entry-close.png",
            "icons/g6-pro-entry-open.png"
          ]
        },
        "source": "protect",
        "uniqueId": "00000000000000000000000c",
        "type": "UVC G6 Pro Entry",
        "supportLicensePlate": true,
        "supportDetectLPOnly": true,
        "videoWidth": 3024,
        "videoHeight": 4096,
        "videoCodec": "h265",
        "lastSeen": 1786606385017,
        "hubMac": "",
        "smartDetectZones": [
          {

            "id": 10001,
            "name": "Test Name 17",
            "color": "#AB46BC",
            "points": [
              [
                0,
                0
              ],
              [
                1,
                0
              ],
              [
                1,
                1
              ],
              [
                0,
                1
              ]
            ],
            "sensitivity": 50,
            "objectTypes": [
              "person",
              "vehicle",
              "animal",
              "face",
              "licensePlate"
            ],
            "isTriggerLightEnabled": true,
            "triggerAccessTypes": [],
            "source": "unifi-access",
            "enableAccessLPOnlyMode": false
          }
        ],
        "allSmartDetectZones": [
          {

            "id": 1,
            "name": "Test Name 67",
            "color": "#AB46BC",
            "points": [
              [
                0,
                0
              ],
              [
                1,
                0
              ],
              [
                1,
                1
              ],
              [
                0,
                1
              ]
            ],
            "sensitivity": 50,
            "objectTypes": [
              "person",
              "vehicle",
              "animal",
              "face"
            ],
            "isTriggerLightEnabled": true,
            "triggerAccessTypes": [],
            "source": "unifi-protect",
            "enableAccessLPOnlyMode": false
          }
        ],
        "smartDetectSettings": {

          "objectTypes": [
            "person",
            "vehicle",
            "animal",
            "package",
            "face",
            "licensePlate"
          ],
          "autoTrackingObjectTypes": [],
          "autoTrackingWithZoom": true,
          "audioTypes": [
            "alrmSmoke",
            "alrmCmonx",
            "alrmSiren",
            "alrmBabyCry",
            "alrmSpeak",
            "alrmBurglar",
            "alrmCarHorn",
            "alrmBark",
            "alrmGlassBreak"
          ],
          "enableTamperDetection": false,
          "detectionRange": {

            "max": 0,
            "min": 0
          }
        },
        "supportDoorAccessConfig": true,
        "recordingSettings": {

          "mode": "always",
          "prePaddingSecs": 2,
          "postPaddingSecs": 2,
          "smartDetectPrePaddingSecs": 2,
          "smartDetectPostPaddingSecs": 2,
          "minMotionEventTrigger": 1000,
          "endMotionEventDelay": 3000,
          "suppressIlluminationSurge": false,
          "inScheduleMode": "always",
          "outScheduleMode": "never",
          "geofencing": "off",
          "motionAlgorithm": "enhanced",
          "enableMotionDetection": false,
          "createAccessEvent": true,
          "useNewMotionAlgorithm": true
        },
        "osdSettings": {

          "isNameEnabled": false,
          "isDateEnabled": true,
          "isLogoEnabled": false,
          "isDebugEnabled": false
        },
        "micVolume": 100,
        "isMicEnabled": true,
        "talkbackSettings": {

          "bindAddr": "192.0.2.14",
          "bindPort": 7004,
          "bitsPerSample": 16,
          "channels": 1,
          "filterAddr": "",
          "filterPort": 0,
          "quality": 100,
          "samplingRate": 22050,
          "typeFmt": "aac",
          "typeIn": "serverudp"
        },
        "hasSpeaker": true,
        "isWaterproofCaseAttached": false,
        "ispSettings": {

          "aeMode": "auto",
          "irLedMode": "auto",
          "irLedLevel": 255,
          "wdr": 1,
          "icrSensitivity": 0,
          "icrSwitchMode": "sensitivity",
          "icrCustomValue": 1,
          "brightness": 50,
          "contrast": 50,
          "hue": 50,
          "saturation": 50,
          "sharpness": 50,
          "denoise": 50,
          "isColorNightVisionEnabled": true,
          "spotlightDuration": 15,
          "isFlippedVertical": false,
          "isFlippedHorizontal": false,
          "isAutoRotateEnabled": false,
          "isLdcEnabled": true,
          "is3dnrEnabled": true,
          "isExternalIrEnabled": false,
          "isAggressiveAntiFlickerEnabled": false,
          "isPauseMotionEnabled": false,
          "dZoomCenterX": 50,
          "dZoomCenterY": 50,
          "dZoomScale": 0,
          "dZoomStreamId": 4,
          "focusPosition": 0,
          "touchFocusX": 1001,
          "touchFocusY": 1001,
          "zoomPosition": 0,
          "mountPosition": "ceiling",
          "hdrMode": "normal",
          "sceneMode": "auto",
          "isSmokeCoverModeEnabled": false
        },
        "isPoorNetwork": false,
        "featureFlags": {

          "smartDetectTypes": [
            "person",
            "vehicle",
            "animal",
            "package",
            "face",
            "licensePlate"
          ],
          "supportDoorAccessConfig": true,
          "supportNfc": false,
          "supportLpOnly": false,
          "supportLpDetectionWithoutVehicle": true,
          "hasMic": true,
          "hasPackageCamera": true,
          "hasPackageZoneSupportForSecondaryLens": true,
          "canOpticalZoom": false,
          "hotPlug": {

            "audio": null
          },
          "reader": {

            "supportAccessMethods": [
              "nfc",
              "touchPass",
              "pinCode",
              "btButton",
              "btTap",
              "face",
              "qrCode"
            ],
            "support2fa": false,
            "supportLocate": true,
            "supportDoorDirection": true,
            "supportCallerManager": true,
            "supportInterfaceDirectory": true,
            "supportGreetings": true,
            "supportShowInterfaceImage": true,
            "supportShowStatusBar": true,
            "supportShowHeading": true,
            "supportGateStop": true
          }
        },
        "currentResolution": "5K",
        "supportNfc": true,
        "supportTouchPass": true,
        "supportFaceUnlock": true,
        "supportBtButton": true,
        "supportBtTap": true,
        "supportQrCode": true,
        "supportPIN": true,
        "supportTwoStepAuth": false,
        "supportGreeting": true,
        "supportDirection": false,
        "supportCallerManager": true,
        "supportMobileUnlockV2": true,
        "supportCallerDirectory": true,
        "supportTwilioSip": false,
        "supportGateStop": true,
        "supportShowInterfaceImage": true,
        "supportShowStatusBar": true,
        "supportShowHeading": true,
        "isFloodlightTriggerEnabled": false,
        "stats": {

          "video": {

            "recordingStart": 1784220871786,
            "recordingEnd": 1786606383001,
            "recordingStartLQ": 1784210492601,
            "recordingEndLQ": 1786606383012
          }
        },
        "location": [],
        "configs": [
          {

            "device_id": "00000000000000000000000c",
            "key": "capture_enable",
            "value": "yes",
            "tag": "device_extra",
            "update_time": "0001-01-01T00:00:00Z",
            "create_time": "0001-01-01T00:00:00Z"
          },
          {

            "device_id": "00000000000000000000000c",
            "key": "capture",
            "value": "yes",
            "tag": "device_extra",
            "update_time": "0001-01-01T00:00:00Z",
            "create_time": "0001-01-01T00:00:00Z"
          },
          {

            "device_id": "00000000000000000000000c",
            "key": "door_entry_method",
            "value": "in",
            "tag": "door_entry_method",
            "update_time": "0001-01-01T00:00:00Z",
            "create_time": "0001-01-01T00:00:00Z"
          }
        ],
        "support_feature": [
          "capture"
        ],
        "bind_same_paired": false,
        "accessDetectZones": [],
        "isAccessReader": false
      }
    }
  },
  {

    "event": "access.data.device.delete",
    "receiver_id": "",
    "event_object_id": "00000000000000000000000c",
    "save_to_history": false,
    "data": {

      "unique_id": "00000000000000000000000c",
      "name": "Test Name 65",
      "alias": "",
      "device_type": "UVC G6 Pro Entry",
      "connected_uah_id": "",
      "location_id": "",
      "firmware": "5.3.95",
      "version": "5.3.95",
      "ip": "192.0.2.13",
      "mac": "aa:bb:cc:00:00:10",
      "hw_type": null,
      "start_time": null,
      "last_seen": null,
      "security_check": null,
      "source": null,
      "bom_rev": null,
      "guid": null,
      "need_advisory": null,
      "is_camera": true,
      "resource_name": "",
      "revision": null,
      "revision_update_time": null,
      "version_update_time": null,
      "firmware_update_time": null,
      "adopt_time": null
    }
  },
  {

    "event": "access.data.v2.device.delete",
    "receiver_id": "",
    "event_object_id": "00000000-0000-0000-0000-00000000003a",
    "save_to_history": false,
    "data": null,
    "meta": {

      "object_type": "device",
      "target_field": null,
      "all_field": true,
      "id": "00000000000000000000000c",
      "source": ""
    }
  },
  {

    "event": "access.data.v2.device.update",
    "receiver_id": "",
    "event_object_id": "00000000-0000-0000-0000-00000000003b",
    "save_to_history": false,
    "data": {

      "name": "Test Name 65",
      "alias": "",
      "id": "00000000000000000000000c",
      "ip": "192.0.2.13",
      "mac": "AABBCC000010",
      "online": true,
      "adopting": false,
      "device_type": "UVC G6 Pro Entry",
      "connected_hub_id": "",
      "location_id": "",
      "firmware": "5.3.95",
      "version": "",
      "guid": "00000000-0000-0000-0000-000000000034",
      "start_time": 1782282073017,
      "hw_type": "",
      "revision": "",
      "cap": [
        "capture",
        "support_register_card"
      ],
      "category": [
        "camera"
      ]
    },
    "meta": {

      "object_type": "device",
      "target_field": null,
      "all_field": true,
      "id": "00000000000000000000000c",
      "source": ""
    }
  },
  {

    "event": "access.data.camera.update",
    "receiver_id": "",
    "event_object_id": "00000000000000000000000c",
    "save_to_history": false,
    "data": {

      "mac": "AABBCC000010",
      "ip": "192.0.2.13",
      "name": "Test Name 65",
      "status": "online",
      "firmwareStatus": "upToDate",
      "firmware": "5.3.95",
      "startupTime": 1782282073187,
      "model": "G6 Pro Entry",
      "shortname": "Test shortname 66",
      "isManaged": true,
      "isAdopted": true,
      "isConnected": true,
      "metadata": {

        "deviceType": "camera",
        "uniqueId": "00000000000000000000000c"
      },
      "guid": "00000000-0000-0000-0000-000000000034",
      "images": {

        "xs": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_25x25.png",
        "s": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_32x32.png",
        "m": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_51x51.png",
        "l": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_64x64.png",
        "xl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_101x101.png",
        "xxl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_128x128.png",
        "animation": [
          "icons/g6-pro-entry-close.png",
          "icons/g6-pro-entry-open.png"
        ]
      },
      "source": "protect",
      "uniqueId": "00000000000000000000000c",
      "type": "UVC G6 Pro Entry",
      "supportLicensePlate": true,
      "supportDetectLPOnly": true,
      "videoWidth": 3024,
      "videoHeight": 4096,
      "videoCodec": "h265",
      "lastSeen": 1786606445187,
      "hubMac": "",
      "smartDetectZones": [
        {

          "id": 10001,
          "name": "Test Name 17",
          "color": "#AB46BC",
          "points": [
            [
              0,
              0
            ],
            [
              1,
              0
            ],
            [
              1,
              1
            ],
            [
              0,
              1
            ]
          ],
          "sensitivity": 50,
          "objectTypes": [
            "person",
            "vehicle",
            "animal",
            "face",
            "licensePlate"
          ],
          "isTriggerLightEnabled": true,
          "triggerAccessTypes": [],
          "source": "unifi-access",
          "enableAccessLPOnlyMode": false
        }
      ],
      "allSmartDetectZones": [
        {

          "id": 1,
          "name": "Test Name 67",
          "color": "#AB46BC",
          "points": [
            [
              0,
              0
            ],
            [
              1,
              0
            ],
            [
              1,
              1
            ],
            [
              0,
              1
            ]
          ],
          "sensitivity": 50,
          "objectTypes": [
            "person",
            "vehicle",
            "animal",
            "face"
          ],
          "isTriggerLightEnabled": true,
          "triggerAccessTypes": [],
          "source": "unifi-protect",
          "enableAccessLPOnlyMode": false
        }
      ],
      "smartDetectSettings": {

        "objectTypes": [
          "person",
          "vehicle",
          "animal",
          "package",
          "face",
          "licensePlate"
        ],
        "autoTrackingObjectTypes": [],
        "autoTrackingWithZoom": true,
        "audioTypes": [
          "alrmSmoke",
          "alrmCmonx",
          "alrmSiren",
          "alrmBabyCry",
          "alrmSpeak",
          "alrmBurglar",
          "alrmCarHorn",
          "alrmBark",
          "alrmGlassBreak"
        ],
        "enableTamperDetection": false,
        "detectionRange": {

          "max": 0,
          "min": 0
        }
      },
      "supportDoorAccessConfig": true,
      "recordingSettings": {

        "mode": "always",
        "prePaddingSecs": 2,
        "postPaddingSecs": 2,
        "smartDetectPrePaddingSecs": 2,
        "smartDetectPostPaddingSecs": 2,
        "minMotionEventTrigger": 1000,
        "endMotionEventDelay": 3000,
        "suppressIlluminationSurge": false,
        "inScheduleMode": "always",
        "outScheduleMode": "never",
        "geofencing": "off",
        "motionAlgorithm": "enhanced",
        "enableMotionDetection": false,
        "createAccessEvent": true,
        "useNewMotionAlgorithm": true
      },
      "osdSettings": {

        "isNameEnabled": false,
        "isDateEnabled": true,
        "isLogoEnabled": false,
        "isDebugEnabled": false
      },
      "micVolume": 100,
      "isMicEnabled": true,
      "talkbackSettings": {

        "bindAddr": "192.0.2.14",
        "bindPort": 7004,
        "bitsPerSample": 16,
        "channels": 1,
        "filterAddr": "",
        "filterPort": 0,
        "quality": 100,
        "samplingRate": 22050,
        "typeFmt": "aac",
        "typeIn": "serverudp"
      },
      "hasSpeaker": true,
      "isWaterproofCaseAttached": false,
      "ispSettings": {

        "aeMode": "auto",
        "irLedMode": "auto",
        "irLedLevel": 255,
        "wdr": 1,
        "icrSensitivity": 0,
        "icrSwitchMode": "sensitivity",
        "icrCustomValue": 1,
        "brightness": 50,
        "contrast": 50,
        "hue": 50,
        "saturation": 50,
        "sharpness": 50,
        "denoise": 50,
        "isColorNightVisionEnabled": true,
        "spotlightDuration": 15,
        "isFlippedVertical": false,
        "isFlippedHorizontal": false,
        "isAutoRotateEnabled": false,
        "isLdcEnabled": true,
        "is3dnrEnabled": true,
        "isExternalIrEnabled": false,
        "isAggressiveAntiFlickerEnabled": false,
        "isPauseMotionEnabled": false,
        "dZoomCenterX": 50,
        "dZoomCenterY": 50,
        "dZoomScale": 0,
        "dZoomStreamId": 4,
        "focusPosition": 0,
        "touchFocusX": 1001,
        "touchFocusY": 1001,
        "zoomPosition": 0,
        "mountPosition": "ceiling",
        "hdrMode": "normal",
        "sceneMode": "auto",
        "isSmokeCoverModeEnabled": false
      },
      "isPoorNetwork": false,
      "featureFlags": {

        "smartDetectTypes": [
          "person",
          "vehicle",
          "animal",
          "package",
          "face",
          "licensePlate"
        ],
        "supportDoorAccessConfig": true,
        "supportNfc": false,
        "supportLpOnly": false,
        "supportLpDetectionWithoutVehicle": true,
        "hasMic": true,
        "hasPackageCamera": true,
        "hasPackageZoneSupportForSecondaryLens": true,
        "canOpticalZoom": false,
        "hotPlug": {

          "audio": null
        },
        "reader": {

          "supportAccessMethods": [
            "nfc",
            "touchPass",
            "pinCode",
            "btButton",
            "btTap",
            "face",
            "qrCode"
          ],
          "support2fa": false,
          "supportLocate": true,
          "supportDoorDirection": true,
          "supportCallerManager": true,
          "supportInterfaceDirectory": true,
          "supportGreetings": true,
          "supportShowInterfaceImage": true,
          "supportShowStatusBar": true,
          "supportShowHeading": true,
          "supportGateStop": true
        }
      },
      "currentResolution": "5K",
      "supportNfc": true,
      "supportTouchPass": true,
      "supportFaceUnlock": true,
      "supportBtButton": true,
      "supportBtTap": true,
      "supportQrCode": true,
      "supportPIN": true,
      "supportTwoStepAuth": false,
      "supportGreeting": true,
      "supportDirection": false,
      "supportCallerManager": true,
      "supportMobileUnlockV2": true,
      "supportCallerDirectory": true,
      "supportTwilioSip": false,
      "supportGateStop": true,
      "supportShowInterfaceImage": true,
      "supportShowStatusBar": true,
      "supportShowHeading": true,
      "isFloodlightTriggerEnabled": false,
      "stats": {

        "video": {

          "recordingStart": 1784220871786,
          "recordingEnd": 1786606432663,
          "recordingStartLQ": 1784210492601,
          "recordingEndLQ": 1786606432678
        }
      },
      "location": [],
      "configs": [
        {

          "device_id": "00000000000000000000000c",
          "key": "capture_enable",
          "value": "yes",
          "tag": "device_extra",
          "update_time": "0001-01-01T00:00:00Z",
          "create_time": "0001-01-01T00:00:00Z"
        },
        {

          "device_id": "00000000000000000000000c",
          "key": "capture",
          "value": "yes",
          "tag": "device_extra",
          "update_time": "0001-01-01T00:00:00Z",
          "create_time": "0001-01-01T00:00:00Z"
        },
        {

          "device_id": "00000000000000000000000c",
          "key": "door_entry_method",
          "value": "in",
          "tag": "door_entry_method",
          "update_time": "0001-01-01T00:00:00Z",
          "create_time": "0001-01-01T00:00:00Z"
        }
      ],
      "support_feature": [
        "capture"
      ],
      "bind_same_paired": false,
      "accessDetectZones": [],
      "isAccessReader": false
    }
  },
  {

    "event": "access.data.device.update",
    "receiver_id": "",
    "event_object_id": "00000000000000000000000c",
    "save_to_history": false,
    "data": {

      "unique_id": "00000000000000000000000c",
      "name": "Test Name 65",
      "alias": "",
      "device_type": "UVC G6 Pro Entry",
      "connected_uah_id": "",
      "location_id": "",
      "firmware": "5.3.95",
      "version": "5.3.95",
      "ip": "192.0.2.13",
      "mac": "aa:bb:cc:00:00:10",
      "hw_type": "",
      "start_time": 1782282073,
      "last_seen": null,
      "security_check": null,
      "source": null,
      "bom_rev": null,
      "guid": "00000000-0000-0000-0000-000000000034",
      "need_advisory": null,
      "is_camera": true,
      "resource_name": "",
      "revision": null,
      "revision_update_time": null,
      "version_update_time": null,
      "firmware_update_time": null,
      "adopt_time": null,
      "location": null,
      "configs": [
        {

          "device_id": "00000000000000000000000c",
          "key": "capture_enable",
          "value": "yes",
          "tag": "device_extra",
          "update_time": "0001-01-01T00:00:00Z",
          "create_time": "0001-01-01T00:00:00Z"
        },
        {

          "device_id": "00000000000000000000000c",
          "key": "capture",
          "value": "yes",
          "tag": "device_extra",
          "update_time": "0001-01-01T00:00:00Z",
          "create_time": "0001-01-01T00:00:00Z"
        },
        {

          "device_id": "00000000000000000000000c",
          "key": "door_entry_method",
          "value": "in",
          "tag": "door_entry_method",
          "update_time": "0001-01-01T00:00:00Z",
          "create_time": "0001-01-01T00:00:00Z"
        }
      ],
      "is_connected": true,
      "is_online": true,
      "is_revision_up_to_date": false,
      "is_adopted": true,
      "is_managed": true,
      "is_upgrade_blocked": false,
      "is_export_sf_blocked": false,
      "is_rebooting": false,
      "update": null,
      "capabilities": [
        "support_register_card",
        "nfc_card_easy_provision",
        "support_mobile_unlock",
        "support_apple_pass",
        "show_face_method",
        "support_inhouse_sdk",
        "anti_spoofing_level",
        "support_face_sensitivity",
        "pin_code",
        "qr_code",
        "support_greeting",
        "support_caller_manager",
        "support_directory_direct",
        "support_show_interface_image",
        "support_show_status_bar",
        "support_show_heading",
        "identity_unlock_control_cmd",
        "support_ems",
        "doorbell_timeout",
        "doorbell_bind",
        "identity_support_ems",
        "identity_remote_view",
        "identity_face_unlock",
        "identity_is_camera",
        "support_record_hq_stream",
        "keypad_layout"
      ],
      "template": null,
      "images": {

        "xs": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_25x25.png",
        "s": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_32x32.png",
        "m": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_51x51.png",
        "l": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_64x64.png",
        "xl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_101x101.png",
        "xxl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_128x128.png",
        "animation": [
          "icons/g6-pro-entry-close.png",
          "icons/g6-pro-entry-open.png"
        ]
      },
      "camera_resource": {

        "mac": "AABBCC000010",
        "ip": "192.0.2.13",
        "name": "Test Name 65",
        "status": "online",
        "firmwareStatus": "upToDate",
        "firmware": "5.3.95",
        "startupTime": 1782282073187,
        "model": "G6 Pro Entry",
        "shortname": "Test shortname 66",
        "isManaged": true,
        "isAdopted": true,
        "isConnected": true,
        "metadata": {

          "deviceType": "camera",
          "uniqueId": "00000000000000000000000c"
        },
        "guid": "00000000-0000-0000-0000-000000000034",
        "images": {

          "xs": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_25x25.png",
          "s": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_32x32.png",
          "m": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_51x51.png",
          "l": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_64x64.png",
          "xl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_101x101.png",
          "xxl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_128x128.png",
          "animation": [
            "icons/g6-pro-entry-close.png",
            "icons/g6-pro-entry-open.png"
          ]
        },
        "source": "protect",
        "uniqueId": "00000000000000000000000c",
        "type": "UVC G6 Pro Entry",
        "supportLicensePlate": true,
        "supportDetectLPOnly": true,
        "videoWidth": 3024,
        "videoHeight": 4096,
        "videoCodec": "h265",
        "lastSeen": 1786606445187,
        "hubMac": "",
        "smartDetectZones": [
          {

            "id": 10001,
            "name": "Test Name 17",
            "color": "#AB46BC",
            "points": [
              [
                0,
                0
              ],
              [
                1,
                0
              ],
              [
                1,
                1
              ],
              [
                0,
                1
              ]
            ],
            "sensitivity": 50,
            "objectTypes": [
              "person",
              "vehicle",
              "animal",
              "face",
              "licensePlate"
            ],
            "isTriggerLightEnabled": true,
            "triggerAccessTypes": [],
            "source": "unifi-access",
            "enableAccessLPOnlyMode": false
          }
        ],
        "allSmartDetectZones": [
          {

            "id": 1,
            "name": "Test Name 67",
            "color": "#AB46BC",
            "points": [
              [
                0,
                0
              ],
              [
                1,
                0
              ],
              [
                1,
                1
              ],
              [
                0,
                1
              ]
            ],
            "sensitivity": 50,
            "objectTypes": [
              "person",
              "vehicle",
              "animal",
              "face"
            ],
            "isTriggerLightEnabled": true,
            "triggerAccessTypes": [],
            "source": "unifi-protect",
            "enableAccessLPOnlyMode": false
          }
        ],
        "smartDetectSettings": {

          "objectTypes": [
            "person",
            "vehicle",
            "animal",
            "package",
            "face",
            "licensePlate"
          ],
          "autoTrackingObjectTypes": [],
          "autoTrackingWithZoom": true,
          "audioTypes": [
            "alrmSmoke",
            "alrmCmonx",
            "alrmSiren",
            "alrmBabyCry",
            "alrmSpeak",
            "alrmBurglar",
            "alrmCarHorn",
            "alrmBark",
            "alrmGlassBreak"
          ],
          "enableTamperDetection": false,
          "detectionRange": {

            "max": 0,
            "min": 0
          }
        },
        "supportDoorAccessConfig": true,
        "recordingSettings": {

          "mode": "always",
          "prePaddingSecs": 2,
          "postPaddingSecs": 2,
          "smartDetectPrePaddingSecs": 2,
          "smartDetectPostPaddingSecs": 2,
          "minMotionEventTrigger": 1000,
          "endMotionEventDelay": 3000,
          "suppressIlluminationSurge": false,
          "inScheduleMode": "always",
          "outScheduleMode": "never",
          "geofencing": "off",
          "motionAlgorithm": "enhanced",
          "enableMotionDetection": false,
          "createAccessEvent": true,
          "useNewMotionAlgorithm": true
        },
        "osdSettings": {

          "isNameEnabled": false,
          "isDateEnabled": true,
          "isLogoEnabled": false,
          "isDebugEnabled": false
        },
        "micVolume": 100,
        "isMicEnabled": true,
        "talkbackSettings": {

          "bindAddr": "192.0.2.14",
          "bindPort": 7004,
          "bitsPerSample": 16,
          "channels": 1,
          "filterAddr": "",
          "filterPort": 0,
          "quality": 100,
          "samplingRate": 22050,
          "typeFmt": "aac",
          "typeIn": "serverudp"
        },
        "hasSpeaker": true,
        "isWaterproofCaseAttached": false,
        "ispSettings": {

          "aeMode": "auto",
          "irLedMode": "auto",
          "irLedLevel": 255,
          "wdr": 1,
          "icrSensitivity": 0,
          "icrSwitchMode": "sensitivity",
          "icrCustomValue": 1,
          "brightness": 50,
          "contrast": 50,
          "hue": 50,
          "saturation": 50,
          "sharpness": 50,
          "denoise": 50,
          "isColorNightVisionEnabled": true,
          "spotlightDuration": 15,
          "isFlippedVertical": false,
          "isFlippedHorizontal": false,
          "isAutoRotateEnabled": false,
          "isLdcEnabled": true,
          "is3dnrEnabled": true,
          "isExternalIrEnabled": false,
          "isAggressiveAntiFlickerEnabled": false,
          "isPauseMotionEnabled": false,
          "dZoomCenterX": 50,
          "dZoomCenterY": 50,
          "dZoomScale": 0,
          "dZoomStreamId": 4,
          "focusPosition": 0,
          "touchFocusX": 1001,
          "touchFocusY": 1001,
          "zoomPosition": 0,
          "mountPosition": "ceiling",
          "hdrMode": "normal",
          "sceneMode": "auto",
          "isSmokeCoverModeEnabled": false
        },
        "isPoorNetwork": false,
        "featureFlags": {

          "smartDetectTypes": [
            "person",
            "vehicle",
            "animal",
            "package",
            "face",
            "licensePlate"
          ],
          "supportDoorAccessConfig": true,
          "supportNfc": false,
          "supportLpOnly": false,
          "supportLpDetectionWithoutVehicle": true,
          "hasMic": true,
          "hasPackageCamera": true,
          "hasPackageZoneSupportForSecondaryLens": true,
          "canOpticalZoom": false,
          "hotPlug": {

            "audio": null
          },
          "reader": {

            "supportAccessMethods": [
              "nfc",
              "touchPass",
              "pinCode",
              "btButton",
              "btTap",
              "face",
              "qrCode"
            ],
            "support2fa": false,
            "supportLocate": true,
            "supportDoorDirection": true,
            "supportCallerManager": true,
            "supportInterfaceDirectory": true,
            "supportGreetings": true,
            "supportShowInterfaceImage": true,
            "supportShowStatusBar": true,
            "supportShowHeading": true,
            "supportGateStop": true
          }
        },
        "currentResolution": "5K",
        "supportNfc": true,
        "supportTouchPass": true,
        "supportFaceUnlock": true,
        "supportBtButton": true,
        "supportBtTap": true,
        "supportQrCode": true,
        "supportPIN": true,
        "supportTwoStepAuth": false,
        "supportGreeting": true,
        "supportDirection": false,
        "supportCallerManager": true,
        "supportMobileUnlockV2": true,
        "supportCallerDirectory": true,
        "supportTwilioSip": false,
        "supportGateStop": true,
        "supportShowInterfaceImage": true,
        "supportShowStatusBar": true,
        "supportShowHeading": true,
        "isFloodlightTriggerEnabled": false,
        "stats": {

          "video": {

            "recordingStart": 1784220871786,
            "recordingEnd": 1786606432663,
            "recordingStartLQ": 1784210492601,
            "recordingEndLQ": 1786606432678
          }
        },
        "location": [],
        "configs": [
          {

            "device_id": "00000000000000000000000c",
            "key": "capture_enable",
            "value": "yes",
            "tag": "device_extra",
            "update_time": "0001-01-01T00:00:00Z",
            "create_time": "0001-01-01T00:00:00Z"
          },
          {

            "device_id": "00000000000000000000000c",
            "key": "capture",
            "value": "yes",
            "tag": "device_extra",
            "update_time": "0001-01-01T00:00:00Z",
            "create_time": "0001-01-01T00:00:00Z"
          },
          {

            "device_id": "00000000000000000000000c",
            "key": "door_entry_method",
            "value": "in",
            "tag": "door_entry_method",
            "update_time": "0001-01-01T00:00:00Z",
            "create_time": "0001-01-01T00:00:00Z"
          }
        ],
        "support_feature": [
          "capture"
        ],
        "bind_same_paired": false,
        "accessDetectZones": [],
        "isAccessReader": false
      }
    }
  },
  {

    "event": "access.data.v2.device.update",
    "receiver_id": "",
    "event_object_id": "00000000-0000-0000-0000-00000000003c",
    "save_to_history": false,
    "data": {

      "name": "Test Name 65",
      "alias": "",
      "id": "00000000000000000000000c",
      "ip": "192.0.2.13",
      "mac": "AABBCC000010",
      "online": true,
      "adopting": false,
      "device_type": "UVC G6 Pro Entry",
      "connected_hub_id": "",
      "location_id": "",
      "firmware": "5.3.95",
      "version": "",
      "guid": "00000000-0000-0000-0000-000000000034",
      "start_time": 1782282073187,
      "hw_type": "",
      "revision": "",
      "cap": [
        "capture",
        "support_register_card"
      ],
      "category": [
        "camera"
      ]
    },
    "meta": {

      "object_type": "device",
      "target_field": null,
      "all_field": true,
      "id": "00000000000000000000000c",
      "source": ""
    }
  },
  {

    "event": "access.data.camera.update",
    "receiver_id": "",
    "event_object_id": "00000000000000000000000c",
    "save_to_history": false,
    "data": {

      "mac": "AABBCC000010",
      "ip": "192.0.2.13",
      "name": "Test Name 65",
      "status": "online",
      "firmwareStatus": "upToDate",
      "firmware": "5.3.95",
      "startupTime": 1782282073187,
      "model": "G6 Pro Entry",
      "shortname": "Test shortname 66",
      "isManaged": true,
      "isAdopted": true,
      "isConnected": true,
      "metadata": {

        "deviceType": "camera",
        "uniqueId": "00000000000000000000000c"
      },
      "guid": "00000000-0000-0000-0000-000000000034",
      "images": {

        "xs": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_25x25.png",
        "s": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_32x32.png",
        "m": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_51x51.png",
        "l": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_64x64.png",
        "xl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_101x101.png",
        "xxl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_128x128.png",
        "animation": [
          "icons/g6-pro-entry-close.png",
          "icons/g6-pro-entry-open.png"
        ]
      },
      "source": "protect",
      "uniqueId": "00000000000000000000000c",
      "type": "UVC G6 Pro Entry",
      "supportLicensePlate": true,
      "supportDetectLPOnly": true,
      "videoWidth": 3024,
      "videoHeight": 4096,
      "videoCodec": "h265",
      "lastSeen": 1786606445187,
      "hubMac": "",
      "smartDetectZones": [
        {

          "id": 10001,
          "name": "Test Name 17",
          "color": "#AB46BC",
          "points": [
            [
              0,
              0
            ],
            [
              1,
              0
            ],
            [
              1,
              1
            ],
            [
              0,
              1
            ]
          ],
          "sensitivity": 50,
          "objectTypes": [
            "person",
            "vehicle",
            "animal",
            "face",
            "licensePlate"
          ],
          "isTriggerLightEnabled": true,
          "triggerAccessTypes": [],
          "source": "unifi-access",
          "enableAccessLPOnlyMode": false
        }
      ],
      "allSmartDetectZones": [
        {

          "id": 1,
          "name": "Test Name 67",
          "color": "#AB46BC",
          "points": [
            [
              0,
              0
            ],
            [
              1,
              0
            ],
            [
              1,
              1
            ],
            [
              0,
              1
            ]
          ],
          "sensitivity": 50,
          "objectTypes": [
            "person",
            "vehicle",
            "animal",
            "face"
          ],
          "isTriggerLightEnabled": true,
          "triggerAccessTypes": [],
          "source": "unifi-protect",
          "enableAccessLPOnlyMode": false
        }
      ],
      "smartDetectSettings": {

        "objectTypes": [
          "person",
          "vehicle",
          "animal",
          "package",
          "face",
          "licensePlate"
        ],
        "autoTrackingObjectTypes": [],
        "autoTrackingWithZoom": true,
        "audioTypes": [
          "alrmSmoke",
          "alrmCmonx",
          "alrmSiren",
          "alrmBabyCry",
          "alrmSpeak",
          "alrmBurglar",
          "alrmCarHorn",
          "alrmBark",
          "alrmGlassBreak"
        ],
        "enableTamperDetection": false,
        "detectionRange": {

          "max": 0,
          "min": 0
        }
      },
      "supportDoorAccessConfig": true,
      "recordingSettings": {

        "mode": "always",
        "prePaddingSecs": 2,
        "postPaddingSecs": 2,
        "smartDetectPrePaddingSecs": 2,
        "smartDetectPostPaddingSecs": 2,
        "minMotionEventTrigger": 1000,
        "endMotionEventDelay": 3000,
        "suppressIlluminationSurge": false,
        "inScheduleMode": "always",
        "outScheduleMode": "never",
        "geofencing": "off",
        "motionAlgorithm": "enhanced",
        "enableMotionDetection": false,
        "createAccessEvent": true,
        "useNewMotionAlgorithm": true
      },
      "osdSettings": {

        "isNameEnabled": false,
        "isDateEnabled": true,
        "isLogoEnabled": false,
        "isDebugEnabled": false
      },
      "micVolume": 100,
      "isMicEnabled": true,
      "talkbackSettings": {

        "bindAddr": "192.0.2.14",
        "bindPort": 7004,
        "bitsPerSample": 16,
        "channels": 1,
        "filterAddr": "",
        "filterPort": 0,
        "quality": 100,
        "samplingRate": 22050,
        "typeFmt": "aac",
        "typeIn": "serverudp"
      },
      "hasSpeaker": true,
      "isWaterproofCaseAttached": false,
      "ispSettings": {

        "aeMode": "auto",
        "irLedMode": "auto",
        "irLedLevel": 255,
        "wdr": 1,
        "icrSensitivity": 0,
        "icrSwitchMode": "sensitivity",
        "icrCustomValue": 1,
        "brightness": 50,
        "contrast": 50,
        "hue": 50,
        "saturation": 50,
        "sharpness": 50,
        "denoise": 50,
        "isColorNightVisionEnabled": true,
        "spotlightDuration": 15,
        "isFlippedVertical": false,
        "isFlippedHorizontal": false,
        "isAutoRotateEnabled": false,
        "isLdcEnabled": true,
        "is3dnrEnabled": true,
        "isExternalIrEnabled": false,
        "isAggressiveAntiFlickerEnabled": false,
        "isPauseMotionEnabled": false,
        "dZoomCenterX": 50,
        "dZoomCenterY": 50,
        "dZoomScale": 0,
        "dZoomStreamId": 4,
        "focusPosition": 0,
        "touchFocusX": 1001,
        "touchFocusY": 1001,
        "zoomPosition": 0,
        "mountPosition": "ceiling",
        "hdrMode": "normal",
        "sceneMode": "auto",
        "isSmokeCoverModeEnabled": false
      },
      "isPoorNetwork": false,
      "featureFlags": {

        "smartDetectTypes": [
          "person",
          "vehicle",
          "animal",
          "package",
          "face",
          "licensePlate"
        ],
        "supportDoorAccessConfig": true,
        "supportNfc": false,
        "supportLpOnly": false,
        "supportLpDetectionWithoutVehicle": true,
        "hasMic": true,
        "hasPackageCamera": true,
        "hasPackageZoneSupportForSecondaryLens": true,
        "canOpticalZoom": false,
        "hotPlug": {

          "audio": null
        },
        "reader": {

          "supportAccessMethods": [
            "nfc",
            "touchPass",
            "pinCode",
            "btButton",
            "btTap",
            "face",
            "qrCode"
          ],
          "support2fa": false,
          "supportLocate": true,
          "supportDoorDirection": true,
          "supportCallerManager": true,
          "supportInterfaceDirectory": true,
          "supportGreetings": true,
          "supportShowInterfaceImage": true,
          "supportShowStatusBar": true,
          "supportShowHeading": true,
          "supportGateStop": true
        }
      },
      "currentResolution": "5K",
      "supportNfc": true,
      "supportTouchPass": true,
      "supportFaceUnlock": true,
      "supportBtButton": true,
      "supportBtTap": true,
      "supportQrCode": true,
      "supportPIN": true,
      "supportTwoStepAuth": false,
      "supportGreeting": true,
      "supportDirection": false,
      "supportCallerManager": true,
      "supportMobileUnlockV2": true,
      "supportCallerDirectory": true,
      "supportTwilioSip": false,
      "supportGateStop": true,
      "supportShowInterfaceImage": true,
      "supportShowStatusBar": true,
      "supportShowHeading": true,
      "isFloodlightTriggerEnabled": false,
      "stats": {

        "video": {

          "recordingStart": 1784220871786,
          "recordingEnd": 1786606482324,
          "recordingStartLQ": 1784210492601,
          "recordingEndLQ": 1786606482338
        }
      },
      "location": [],
      "configs": [
        {

          "device_id": "00000000000000000000000c",
          "key": "capture_enable",
          "value": "yes",
          "tag": "device_extra",
          "update_time": "0001-01-01T00:00:00Z",
          "create_time": "0001-01-01T00:00:00Z"
        },
        {

          "device_id": "00000000000000000000000c",
          "key": "capture",
          "value": "yes",
          "tag": "device_extra",
          "update_time": "0001-01-01T00:00:00Z",
          "create_time": "0001-01-01T00:00:00Z"
        },
        {

          "device_id": "00000000000000000000000c",
          "key": "door_entry_method",
          "value": "in",
          "tag": "door_entry_method",
          "update_time": "0001-01-01T00:00:00Z",
          "create_time": "0001-01-01T00:00:00Z"
        }
      ],
      "support_feature": [
        "capture"
      ],
      "bind_same_paired": false,
      "accessDetectZones": [],
      "isAccessReader": false
    }
  },
  {

    "event": "access.data.device.update",
    "receiver_id": "",
    "event_object_id": "00000000000000000000000c",
    "save_to_history": false,
    "data": {

      "unique_id": "00000000000000000000000c",
      "name": "Test Name 65",
      "alias": "",
      "device_type": "UVC G6 Pro Entry",
      "connected_uah_id": "",
      "location_id": "",
      "firmware": "5.3.95",
      "version": "5.3.95",
      "ip": "192.0.2.13",
      "mac": "aa:bb:cc:00:00:10",
      "hw_type": "",
      "start_time": 1782282073,
      "last_seen": null,
      "security_check": null,
      "source": null,
      "bom_rev": null,
      "guid": "00000000-0000-0000-0000-000000000034",
      "need_advisory": null,
      "is_camera": true,
      "resource_name": "",
      "revision": null,
      "revision_update_time": null,
      "version_update_time": null,
      "firmware_update_time": null,
      "adopt_time": null,
      "location": null,
      "configs": [
        {

          "device_id": "00000000000000000000000c",
          "key": "capture_enable",
          "value": "yes",
          "tag": "device_extra",
          "update_time": "0001-01-01T00:00:00Z",
          "create_time": "0001-01-01T00:00:00Z"
        },
        {

          "device_id": "00000000000000000000000c",
          "key": "capture",
          "value": "yes",
          "tag": "device_extra",
          "update_time": "0001-01-01T00:00:00Z",
          "create_time": "0001-01-01T00:00:00Z"
        },
        {

          "device_id": "00000000000000000000000c",
          "key": "door_entry_method",
          "value": "in",
          "tag": "door_entry_method",
          "update_time": "0001-01-01T00:00:00Z",
          "create_time": "0001-01-01T00:00:00Z"
        }
      ],
      "is_connected": true,
      "is_online": true,
      "is_revision_up_to_date": false,
      "is_adopted": true,
      "is_managed": true,
      "is_upgrade_blocked": false,
      "is_export_sf_blocked": false,
      "is_rebooting": false,
      "update": null,
      "capabilities": [
        "support_register_card",
        "nfc_card_easy_provision",
        "support_mobile_unlock",
        "support_apple_pass",
        "show_face_method",
        "support_inhouse_sdk",
        "anti_spoofing_level",
        "support_face_sensitivity",
        "pin_code",
        "qr_code",
        "support_greeting",
        "support_caller_manager",
        "support_directory_direct",
        "support_show_interface_image",
        "support_show_status_bar",
        "support_show_heading",
        "identity_unlock_control_cmd",
        "support_ems",
        "doorbell_timeout",
        "doorbell_bind",
        "identity_support_ems",
        "identity_remote_view",
        "identity_face_unlock",
        "identity_is_camera",
        "support_record_hq_stream",
        "keypad_layout"
      ],
      "template": null,
      "images": {

        "xs": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_25x25.png",
        "s": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_32x32.png",
        "m": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_51x51.png",
        "l": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_64x64.png",
        "xl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_101x101.png",
        "xxl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_128x128.png",
        "animation": [
          "icons/g6-pro-entry-close.png",
          "icons/g6-pro-entry-open.png"
        ]
      },
      "camera_resource": {

        "mac": "AABBCC000010",
        "ip": "192.0.2.13",
        "name": "Test Name 65",
        "status": "online",
        "firmwareStatus": "upToDate",
        "firmware": "5.3.95",
        "startupTime": 1782282073187,
        "model": "G6 Pro Entry",
        "shortname": "Test shortname 66",
        "isManaged": true,
        "isAdopted": true,
        "isConnected": true,
        "metadata": {

          "deviceType": "camera",
          "uniqueId": "00000000000000000000000c"
        },
        "guid": "00000000-0000-0000-0000-000000000034",
        "images": {

          "xs": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_25x25.png",
          "s": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_32x32.png",
          "m": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_51x51.png",
          "l": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_64x64.png",
          "xl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_101x101.png",
          "xxl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_128x128.png",
          "animation": [
            "icons/g6-pro-entry-close.png",
            "icons/g6-pro-entry-open.png"
          ]
        },
        "source": "protect",
        "uniqueId": "00000000000000000000000c",
        "type": "UVC G6 Pro Entry",
        "supportLicensePlate": true,
        "supportDetectLPOnly": true,
        "videoWidth": 3024,
        "videoHeight": 4096,
        "videoCodec": "h265",
        "lastSeen": 1786606445187,
        "hubMac": "",
        "smartDetectZones": [
          {

            "id": 10001,
            "name": "Test Name 17",
            "color": "#AB46BC",
            "points": [
              [
                0,
                0
              ],
              [
                1,
                0
              ],
              [
                1,
                1
              ],
              [
                0,
                1
              ]
            ],
            "sensitivity": 50,
            "objectTypes": [
              "person",
              "vehicle",
              "animal",
              "face",
              "licensePlate"
            ],
            "isTriggerLightEnabled": true,
            "triggerAccessTypes": [],
            "source": "unifi-access",
            "enableAccessLPOnlyMode": false
          }
        ],
        "allSmartDetectZones": [
          {

            "id": 1,
            "name": "Test Name 67",
            "color": "#AB46BC",
            "points": [
              [
                0,
                0
              ],
              [
                1,
                0
              ],
              [
                1,
                1
              ],
              [
                0,
                1
              ]
            ],
            "sensitivity": 50,
            "objectTypes": [
              "person",
              "vehicle",
              "animal",
              "face"
            ],
            "isTriggerLightEnabled": true,
            "triggerAccessTypes": [],
            "source": "unifi-protect",
            "enableAccessLPOnlyMode": false
          }
        ],
        "smartDetectSettings": {

          "objectTypes": [
            "person",
            "vehicle",
            "animal",
            "package",
            "face",
            "licensePlate"
          ],
          "autoTrackingObjectTypes": [],
          "autoTrackingWithZoom": true,
          "audioTypes": [
            "alrmSmoke",
            "alrmCmonx",
            "alrmSiren",
            "alrmBabyCry",
            "alrmSpeak",
            "alrmBurglar",
            "alrmCarHorn",
            "alrmBark",
            "alrmGlassBreak"
          ],
          "enableTamperDetection": false,
          "detectionRange": {

            "max": 0,
            "min": 0
          }
        },
        "supportDoorAccessConfig": true,
        "recordingSettings": {

          "mode": "always",
          "prePaddingSecs": 2,
          "postPaddingSecs": 2,
          "smartDetectPrePaddingSecs": 2,
          "smartDetectPostPaddingSecs": 2,
          "minMotionEventTrigger": 1000,
          "endMotionEventDelay": 3000,
          "suppressIlluminationSurge": false,
          "inScheduleMode": "always",
          "outScheduleMode": "never",
          "geofencing": "off",
          "motionAlgorithm": "enhanced",
          "enableMotionDetection": false,
          "createAccessEvent": true,
          "useNewMotionAlgorithm": true
        },
        "osdSettings": {

          "isNameEnabled": false,
          "isDateEnabled": true,
          "isLogoEnabled": false,
          "isDebugEnabled": false
        },
        "micVolume": 100,
        "isMicEnabled": true,
        "talkbackSettings": {

          "bindAddr": "192.0.2.14",
          "bindPort": 7004,
          "bitsPerSample": 16,
          "channels": 1,
          "filterAddr": "",
          "filterPort": 0,
          "quality": 100,
          "samplingRate": 22050,
          "typeFmt": "aac",
          "typeIn": "serverudp"
        },
        "hasSpeaker": true,
        "isWaterproofCaseAttached": false,
        "ispSettings": {

          "aeMode": "auto",
          "irLedMode": "auto",
          "irLedLevel": 255,
          "wdr": 1,
          "icrSensitivity": 0,
          "icrSwitchMode": "sensitivity",
          "icrCustomValue": 1,
          "brightness": 50,
          "contrast": 50,
          "hue": 50,
          "saturation": 50,
          "sharpness": 50,
          "denoise": 50,
          "isColorNightVisionEnabled": true,
          "spotlightDuration": 15,
          "isFlippedVertical": false,
          "isFlippedHorizontal": false,
          "isAutoRotateEnabled": false,
          "isLdcEnabled": true,
          "is3dnrEnabled": true,
          "isExternalIrEnabled": false,
          "isAggressiveAntiFlickerEnabled": false,
          "isPauseMotionEnabled": false,
          "dZoomCenterX": 50,
          "dZoomCenterY": 50,
          "dZoomScale": 0,
          "dZoomStreamId": 4,
          "focusPosition": 0,
          "touchFocusX": 1001,
          "touchFocusY": 1001,
          "zoomPosition": 0,
          "mountPosition": "ceiling",
          "hdrMode": "normal",
          "sceneMode": "auto",
          "isSmokeCoverModeEnabled": false
        },
        "isPoorNetwork": false,
        "featureFlags": {

          "smartDetectTypes": [
            "person",
            "vehicle",
            "animal",
            "package",
            "face",
            "licensePlate"
          ],
          "supportDoorAccessConfig": true,
          "supportNfc": false,
          "supportLpOnly": false,
          "supportLpDetectionWithoutVehicle": true,
          "hasMic": true,
          "hasPackageCamera": true,
          "hasPackageZoneSupportForSecondaryLens": true,
          "canOpticalZoom": false,
          "hotPlug": {

            "audio": null
          },
          "reader": {

            "supportAccessMethods": [
              "nfc",
              "touchPass",
              "pinCode",
              "btButton",
              "btTap",
              "face",
              "qrCode"
            ],
            "support2fa": false,
            "supportLocate": true,
            "supportDoorDirection": true,
            "supportCallerManager": true,
            "supportInterfaceDirectory": true,
            "supportGreetings": true,
            "supportShowInterfaceImage": true,
            "supportShowStatusBar": true,
            "supportShowHeading": true,
            "supportGateStop": true
          }
        },
        "currentResolution": "5K",
        "supportNfc": true,
        "supportTouchPass": true,
        "supportFaceUnlock": true,
        "supportBtButton": true,
        "supportBtTap": true,
        "supportQrCode": true,
        "supportPIN": true,
        "supportTwoStepAuth": false,
        "supportGreeting": true,
        "supportDirection": false,
        "supportCallerManager": true,
        "supportMobileUnlockV2": true,
        "supportCallerDirectory": true,
        "supportTwilioSip": false,
        "supportGateStop": true,
        "supportShowInterfaceImage": true,
        "supportShowStatusBar": true,
        "supportShowHeading": true,
        "isFloodlightTriggerEnabled": false,
        "stats": {

          "video": {

            "recordingStart": 1784220871786,
            "recordingEnd": 1786606482324,
            "recordingStartLQ": 1784210492601,
            "recordingEndLQ": 1786606482338
          }
        },
        "location": [],
        "configs": [
          {

            "device_id": "00000000000000000000000c",
            "key": "capture_enable",
            "value": "yes",
            "tag": "device_extra",
            "update_time": "0001-01-01T00:00:00Z",
            "create_time": "0001-01-01T00:00:00Z"
          },
          {

            "device_id": "00000000000000000000000c",
            "key": "capture",
            "value": "yes",
            "tag": "device_extra",
            "update_time": "0001-01-01T00:00:00Z",
            "create_time": "0001-01-01T00:00:00Z"
          },
          {

            "device_id": "00000000000000000000000c",
            "key": "door_entry_method",
            "value": "in",
            "tag": "door_entry_method",
            "update_time": "0001-01-01T00:00:00Z",
            "create_time": "0001-01-01T00:00:00Z"
          }
        ],
        "support_feature": [
          "capture"
        ],
        "bind_same_paired": false,
        "accessDetectZones": [],
        "isAccessReader": false
      }
    }
  },
  {

    "event": "access.data.v2.device.update",
    "receiver_id": "",
    "event_object_id": "00000000-0000-0000-0000-00000000003d",
    "save_to_history": false,
    "data": {

      "name": "Test Name 65",
      "alias": "",
      "id": "00000000000000000000000c",
      "ip": "192.0.2.13",
      "mac": "AABBCC000010",
      "online": true,
      "adopting": false,
      "device_type": "UVC G6 Pro Entry",
      "connected_hub_id": "",
      "location_id": "",
      "firmware": "5.3.95",
      "version": "",
      "guid": "00000000-0000-0000-0000-000000000034",
      "start_time": 1782282073187,
      "hw_type": "",
      "revision": "",
      "cap": [
        "capture",
        "support_register_card"
      ],
      "category": [
        "camera"
      ]
    },
    "meta": {

      "object_type": "device",
      "target_field": null,
      "all_field": true,
      "id": "00000000000000000000000c",
      "source": ""
    }
  },
  {

    "event": "access.data.camera.update",
    "receiver_id": "",
    "event_object_id": "00000000000000000000000c",
    "save_to_history": false,
    "data": {

      "mac": "AABBCC000010",
      "ip": "192.0.2.13",
      "name": "Test Name 65",
      "status": "online",
      "firmwareStatus": "upToDate",
      "firmware": "5.3.95",
      "startupTime": 1782282073046,
      "model": "G6 Pro Entry",
      "shortname": "Test shortname 66",
      "isManaged": true,
      "isAdopted": true,
      "isConnected": true,
      "metadata": {

        "deviceType": "camera",
        "uniqueId": "00000000000000000000000c"
      },
      "guid": "00000000-0000-0000-0000-000000000034",
      "images": {

        "xs": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_25x25.png",
        "s": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_32x32.png",
        "m": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_51x51.png",
        "l": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_64x64.png",
        "xl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_101x101.png",
        "xxl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_128x128.png",
        "animation": [
          "icons/g6-pro-entry-close.png",
          "icons/g6-pro-entry-open.png"
        ]
      },
      "source": "protect",
      "uniqueId": "00000000000000000000000c",
      "type": "UVC G6 Pro Entry",
      "supportLicensePlate": true,
      "supportDetectLPOnly": true,
      "videoWidth": 3024,
      "videoHeight": 4096,
      "videoCodec": "h265",
      "lastSeen": 1786606505046,
      "hubMac": "",
      "smartDetectZones": [
        {

          "id": 10001,
          "name": "Test Name 17",
          "color": "#AB46BC",
          "points": [
            [
              0,
              0
            ],
            [
              1,
              0
            ],
            [
              1,
              1
            ],
            [
              0,
              1
            ]
          ],
          "sensitivity": 50,
          "objectTypes": [
            "person",
            "vehicle",
            "animal",
            "face",
            "licensePlate"
          ],
          "isTriggerLightEnabled": true,
          "triggerAccessTypes": [],
          "source": "unifi-access",
          "enableAccessLPOnlyMode": false
        }
      ],
      "allSmartDetectZones": [
        {

          "id": 1,
          "name": "Test Name 67",
          "color": "#AB46BC",
          "points": [
            [
              0,
              0
            ],
            [
              1,
              0
            ],
            [
              1,
              1
            ],
            [
              0,
              1
            ]
          ],
          "sensitivity": 50,
          "objectTypes": [
            "person",
            "vehicle",
            "animal",
            "face"
          ],
          "isTriggerLightEnabled": true,
          "triggerAccessTypes": [],
          "source": "unifi-protect",
          "enableAccessLPOnlyMode": false
        }
      ],
      "smartDetectSettings": {

        "objectTypes": [
          "person",
          "vehicle",
          "animal",
          "package",
          "face",
          "licensePlate"
        ],
        "autoTrackingObjectTypes": [],
        "autoTrackingWithZoom": true,
        "audioTypes": [
          "alrmSmoke",
          "alrmCmonx",
          "alrmSiren",
          "alrmBabyCry",
          "alrmSpeak",
          "alrmBurglar",
          "alrmCarHorn",
          "alrmBark",
          "alrmGlassBreak"
        ],
        "enableTamperDetection": false,
        "detectionRange": {

          "max": 0,
          "min": 0
        }
      },
      "supportDoorAccessConfig": true,
      "recordingSettings": {

        "mode": "always",
        "prePaddingSecs": 2,
        "postPaddingSecs": 2,
        "smartDetectPrePaddingSecs": 2,
        "smartDetectPostPaddingSecs": 2,
        "minMotionEventTrigger": 1000,
        "endMotionEventDelay": 3000,
        "suppressIlluminationSurge": false,
        "inScheduleMode": "always",
        "outScheduleMode": "never",
        "geofencing": "off",
        "motionAlgorithm": "enhanced",
        "enableMotionDetection": false,
        "createAccessEvent": true,
        "useNewMotionAlgorithm": true
      },
      "osdSettings": {

        "isNameEnabled": false,
        "isDateEnabled": true,
        "isLogoEnabled": false,
        "isDebugEnabled": false
      },
      "micVolume": 100,
      "isMicEnabled": true,
      "talkbackSettings": {

        "bindAddr": "192.0.2.14",
        "bindPort": 7004,
        "bitsPerSample": 16,
        "channels": 1,
        "filterAddr": "",
        "filterPort": 0,
        "quality": 100,
        "samplingRate": 22050,
        "typeFmt": "aac",
        "typeIn": "serverudp"
      },
      "hasSpeaker": true,
      "isWaterproofCaseAttached": false,
      "ispSettings": {

        "aeMode": "auto",
        "irLedMode": "auto",
        "irLedLevel": 255,
        "wdr": 1,
        "icrSensitivity": 0,
        "icrSwitchMode": "sensitivity",
        "icrCustomValue": 1,
        "brightness": 50,
        "contrast": 50,
        "hue": 50,
        "saturation": 50,
        "sharpness": 50,
        "denoise": 50,
        "isColorNightVisionEnabled": true,
        "spotlightDuration": 15,
        "isFlippedVertical": false,
        "isFlippedHorizontal": false,
        "isAutoRotateEnabled": false,
        "isLdcEnabled": true,
        "is3dnrEnabled": true,
        "isExternalIrEnabled": false,
        "isAggressiveAntiFlickerEnabled": false,
        "isPauseMotionEnabled": false,
        "dZoomCenterX": 50,
        "dZoomCenterY": 50,
        "dZoomScale": 0,
        "dZoomStreamId": 4,
        "focusPosition": 0,
        "touchFocusX": 1001,
        "touchFocusY": 1001,
        "zoomPosition": 0,
        "mountPosition": "ceiling",
        "hdrMode": "normal",
        "sceneMode": "auto",
        "isSmokeCoverModeEnabled": false
      },
      "isPoorNetwork": false,
      "featureFlags": {

        "smartDetectTypes": [
          "person",
          "vehicle",
          "animal",
          "package",
          "face",
          "licensePlate"
        ],
        "supportDoorAccessConfig": true,
        "supportNfc": false,
        "supportLpOnly": false,
        "supportLpDetectionWithoutVehicle": true,
        "hasMic": true,
        "hasPackageCamera": true,
        "hasPackageZoneSupportForSecondaryLens": true,
        "canOpticalZoom": false,
        "hotPlug": {

          "audio": null
        },
        "reader": {

          "supportAccessMethods": [
            "nfc",
            "touchPass",
            "pinCode",
            "btButton",
            "btTap",
            "face",
            "qrCode"
          ],
          "support2fa": false,
          "supportLocate": true,
          "supportDoorDirection": true,
          "supportCallerManager": true,
          "supportInterfaceDirectory": true,
          "supportGreetings": true,
          "supportShowInterfaceImage": true,
          "supportShowStatusBar": true,
          "supportShowHeading": true,
          "supportGateStop": true
        }
      },
      "currentResolution": "5K",
      "supportNfc": true,
      "supportTouchPass": true,
      "supportFaceUnlock": true,
      "supportBtButton": true,
      "supportBtTap": true,
      "supportQrCode": true,
      "supportPIN": true,
      "supportTwoStepAuth": false,
      "supportGreeting": true,
      "supportDirection": false,
      "supportCallerManager": true,
      "supportMobileUnlockV2": true,
      "supportCallerDirectory": true,
      "supportTwilioSip": false,
      "supportGateStop": true,
      "supportShowInterfaceImage": true,
      "supportShowStatusBar": true,
      "supportShowHeading": true,
      "isFloodlightTriggerEnabled": false,
      "stats": {

        "video": {

          "recordingStart": 1784220871786,
          "recordingEnd": 1786606531989,
          "recordingStartLQ": 1784210492601,
          "recordingEndLQ": 1786606532010
        }
      },
      "location": [],
      "configs": [
        {

          "device_id": "00000000000000000000000c",
          "key": "capture_enable",
          "value": "yes",
          "tag": "device_extra",
          "update_time": "0001-01-01T00:00:00Z",
          "create_time": "0001-01-01T00:00:00Z"
        },
        {

          "device_id": "00000000000000000000000c",
          "key": "capture",
          "value": "yes",
          "tag": "device_extra",
          "update_time": "0001-01-01T00:00:00Z",
          "create_time": "0001-01-01T00:00:00Z"
        },
        {

          "device_id": "00000000000000000000000c",
          "key": "door_entry_method",
          "value": "in",
          "tag": "door_entry_method",
          "update_time": "0001-01-01T00:00:00Z",
          "create_time": "0001-01-01T00:00:00Z"
        }
      ],
      "support_feature": [
        "capture"
      ],
      "bind_same_paired": false,
      "accessDetectZones": [],
      "isAccessReader": false
    }
  },
  {

    "event": "access.data.device.delete",
    "receiver_id": "",
    "event_object_id": "00000000000000000000000c",
    "save_to_history": false,
    "data": {

      "unique_id": "00000000000000000000000c",
      "name": "Test Name 65",
      "alias": "",
      "device_type": "UVC G6 Pro Entry",
      "connected_uah_id": "",
      "location_id": "",
      "firmware": "5.3.95",
      "version": "5.3.95",
      "ip": "192.0.2.13",
      "mac": "aa:bb:cc:00:00:10",
      "hw_type": null,
      "start_time": null,
      "last_seen": null,
      "security_check": null,
      "source": null,
      "bom_rev": null,
      "guid": null,
      "need_advisory": null,
      "is_camera": true,
      "resource_name": "",
      "revision": null,
      "revision_update_time": null,
      "version_update_time": null,
      "firmware_update_time": null,
      "adopt_time": null
    }
  },
  {

    "event": "access.data.v2.device.delete",
    "receiver_id": "",
    "event_object_id": "00000000-0000-0000-0000-00000000003e",
    "save_to_history": false,
    "data": null,
    "meta": {

      "object_type": "device",
      "target_field": null,
      "all_field": true,
      "id": "00000000000000000000000c",
      "source": ""
    }
  },
  {

    "event": "access.data.device.update",
    "receiver_id": "",
    "event_object_id": "00000000000000000000000c",
    "save_to_history": false,
    "data": {

      "unique_id": "00000000000000000000000c",
      "name": "Test Name 65",
      "alias": "",
      "device_type": "UVC G6 Pro Entry",
      "connected_uah_id": "",
      "location_id": "",
      "firmware": "5.3.95",
      "version": "5.3.95",
      "ip": "192.0.2.13",
      "mac": "aa:bb:cc:00:00:10",
      "hw_type": "",
      "start_time": 1782282073,
      "last_seen": null,
      "security_check": null,
      "source": null,
      "bom_rev": null,
      "guid": "00000000-0000-0000-0000-000000000034",
      "need_advisory": null,
      "is_camera": true,
      "resource_name": "",
      "revision": null,
      "revision_update_time": null,
      "version_update_time": null,
      "firmware_update_time": null,
      "adopt_time": null,
      "location": null,
      "configs": [
        {

          "device_id": "00000000000000000000000c",
          "key": "capture_enable",
          "value": "yes",
          "tag": "device_extra",
          "update_time": "0001-01-01T00:00:00Z",
          "create_time": "0001-01-01T00:00:00Z"
        },
        {

          "device_id": "00000000000000000000000c",
          "key": "capture",
          "value": "yes",
          "tag": "device_extra",
          "update_time": "0001-01-01T00:00:00Z",
          "create_time": "0001-01-01T00:00:00Z"
        },
        {

          "device_id": "00000000000000000000000c",
          "key": "door_entry_method",
          "value": "in",
          "tag": "door_entry_method",
          "update_time": "0001-01-01T00:00:00Z",
          "create_time": "0001-01-01T00:00:00Z"
        }
      ],
      "is_connected": true,
      "is_online": true,
      "is_revision_up_to_date": false,
      "is_adopted": true,
      "is_managed": true,
      "is_upgrade_blocked": false,
      "is_export_sf_blocked": false,
      "is_rebooting": false,
      "update": null,
      "capabilities": [
        "support_register_card",
        "nfc_card_easy_provision",
        "support_mobile_unlock",
        "support_apple_pass",
        "show_face_method",
        "support_inhouse_sdk",
        "anti_spoofing_level",
        "support_face_sensitivity",
        "pin_code",
        "qr_code",
        "support_greeting",
        "support_caller_manager",
        "support_directory_direct",
        "support_show_interface_image",
        "support_show_status_bar",
        "support_show_heading",
        "identity_unlock_control_cmd",
        "support_ems",
        "doorbell_timeout",
        "doorbell_bind",
        "identity_support_ems",
        "identity_remote_view",
        "identity_face_unlock",
        "identity_is_camera",
        "support_record_hq_stream",
        "keypad_layout"
      ],
      "template": null,
      "images": {

        "xs": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_25x25.png",
        "s": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_32x32.png",
        "m": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_51x51.png",
        "l": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_64x64.png",
        "xl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_101x101.png",
        "xxl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_128x128.png",
        "animation": [
          "icons/g6-pro-entry-close.png",
          "icons/g6-pro-entry-open.png"
        ]
      },
      "camera_resource": {

        "mac": "AABBCC000010",
        "ip": "192.0.2.13",
        "name": "Test Name 65",
        "status": "online",
        "firmwareStatus": "upToDate",
        "firmware": "5.3.95",
        "startupTime": 1782282073046,
        "model": "G6 Pro Entry",
        "shortname": "Test shortname 66",
        "isManaged": true,
        "isAdopted": true,
        "isConnected": true,
        "metadata": {

          "deviceType": "camera",
          "uniqueId": "00000000000000000000000c"
        },
        "guid": "00000000-0000-0000-0000-000000000034",
        "images": {

          "xs": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_25x25.png",
          "s": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_32x32.png",
          "m": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_51x51.png",
          "l": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_64x64.png",
          "xl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_101x101.png",
          "xxl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_128x128.png",
          "animation": [
            "icons/g6-pro-entry-close.png",
            "icons/g6-pro-entry-open.png"
          ]
        },
        "source": "protect",
        "uniqueId": "00000000000000000000000c",
        "type": "UVC G6 Pro Entry",
        "supportLicensePlate": true,
        "supportDetectLPOnly": true,
        "videoWidth": 3024,
        "videoHeight": 4096,
        "videoCodec": "h265",
        "lastSeen": 1786606505046,
        "hubMac": "",
        "smartDetectZones": [
          {

            "id": 10001,
            "name": "Test Name 17",
            "color": "#AB46BC",
            "points": [
              [
                0,
                0
              ],
              [
                1,
                0
              ],
              [
                1,
                1
              ],
              [
                0,
                1
              ]
            ],
            "sensitivity": 50,
            "objectTypes": [
              "person",
              "vehicle",
              "animal",
              "face",
              "licensePlate"
            ],
            "isTriggerLightEnabled": true,
            "triggerAccessTypes": [],
            "source": "unifi-access",
            "enableAccessLPOnlyMode": false
          }
        ],
        "allSmartDetectZones": [
          {

            "id": 1,
            "name": "Test Name 67",
            "color": "#AB46BC",
            "points": [
              [
                0,
                0
              ],
              [
                1,
                0
              ],
              [
                1,
                1
              ],
              [
                0,
                1
              ]
            ],
            "sensitivity": 50,
            "objectTypes": [
              "person",
              "vehicle",
              "animal",
              "face"
            ],
            "isTriggerLightEnabled": true,
            "triggerAccessTypes": [],
            "source": "unifi-protect",
            "enableAccessLPOnlyMode": false
          }
        ],
        "smartDetectSettings": {

          "objectTypes": [
            "person",
            "vehicle",
            "animal",
            "package",
            "face",
            "licensePlate"
          ],
          "autoTrackingObjectTypes": [],
          "autoTrackingWithZoom": true,
          "audioTypes": [
            "alrmSmoke",
            "alrmCmonx",
            "alrmSiren",
            "alrmBabyCry",
            "alrmSpeak",
            "alrmBurglar",
            "alrmCarHorn",
            "alrmBark",
            "alrmGlassBreak"
          ],
          "enableTamperDetection": false,
          "detectionRange": {

            "max": 0,
            "min": 0
          }
        },
        "supportDoorAccessConfig": true,
        "recordingSettings": {

          "mode": "always",
          "prePaddingSecs": 2,
          "postPaddingSecs": 2,
          "smartDetectPrePaddingSecs": 2,
          "smartDetectPostPaddingSecs": 2,
          "minMotionEventTrigger": 1000,
          "endMotionEventDelay": 3000,
          "suppressIlluminationSurge": false,
          "inScheduleMode": "always",
          "outScheduleMode": "never",
          "geofencing": "off",
          "motionAlgorithm": "enhanced",
          "enableMotionDetection": false,
          "createAccessEvent": true,
          "useNewMotionAlgorithm": true
        },
        "osdSettings": {

          "isNameEnabled": false,
          "isDateEnabled": true,
          "isLogoEnabled": false,
          "isDebugEnabled": false
        },
        "micVolume": 100,
        "isMicEnabled": true,
        "talkbackSettings": {

          "bindAddr": "192.0.2.14",
          "bindPort": 7004,
          "bitsPerSample": 16,
          "channels": 1,
          "filterAddr": "",
          "filterPort": 0,
          "quality": 100,
          "samplingRate": 22050,
          "typeFmt": "aac",
          "typeIn": "serverudp"
        },
        "hasSpeaker": true,
        "isWaterproofCaseAttached": false,
        "ispSettings": {

          "aeMode": "auto",
          "irLedMode": "auto",
          "irLedLevel": 255,
          "wdr": 1,
          "icrSensitivity": 0,
          "icrSwitchMode": "sensitivity",
          "icrCustomValue": 1,
          "brightness": 50,
          "contrast": 50,
          "hue": 50,
          "saturation": 50,
          "sharpness": 50,
          "denoise": 50,
          "isColorNightVisionEnabled": true,
          "spotlightDuration": 15,
          "isFlippedVertical": false,
          "isFlippedHorizontal": false,
          "isAutoRotateEnabled": false,
          "isLdcEnabled": true,
          "is3dnrEnabled": true,
          "isExternalIrEnabled": false,
          "isAggressiveAntiFlickerEnabled": false,
          "isPauseMotionEnabled": false,
          "dZoomCenterX": 50,
          "dZoomCenterY": 50,
          "dZoomScale": 0,
          "dZoomStreamId": 4,
          "focusPosition": 0,
          "touchFocusX": 1001,
          "touchFocusY": 1001,
          "zoomPosition": 0,
          "mountPosition": "ceiling",
          "hdrMode": "normal",
          "sceneMode": "auto",
          "isSmokeCoverModeEnabled": false
        },
        "isPoorNetwork": false,
        "featureFlags": {

          "smartDetectTypes": [
            "person",
            "vehicle",
            "animal",
            "package",
            "face",
            "licensePlate"
          ],
          "supportDoorAccessConfig": true,
          "supportNfc": false,
          "supportLpOnly": false,
          "supportLpDetectionWithoutVehicle": true,
          "hasMic": true,
          "hasPackageCamera": true,
          "hasPackageZoneSupportForSecondaryLens": true,
          "canOpticalZoom": false,
          "hotPlug": {

            "audio": null
          },
          "reader": {

            "supportAccessMethods": [
              "nfc",
              "touchPass",
              "pinCode",
              "btButton",
              "btTap",
              "face",
              "qrCode"
            ],
            "support2fa": false,
            "supportLocate": true,
            "supportDoorDirection": true,
            "supportCallerManager": true,
            "supportInterfaceDirectory": true,
            "supportGreetings": true,
            "supportShowInterfaceImage": true,
            "supportShowStatusBar": true,
            "supportShowHeading": true,
            "supportGateStop": true
          }
        },
        "currentResolution": "5K",
        "supportNfc": true,
        "supportTouchPass": true,
        "supportFaceUnlock": true,
        "supportBtButton": true,
        "supportBtTap": true,
        "supportQrCode": true,
        "supportPIN": true,
        "supportTwoStepAuth": false,
        "supportGreeting": true,
        "supportDirection": false,
        "supportCallerManager": true,
        "supportMobileUnlockV2": true,
        "supportCallerDirectory": true,
        "supportTwilioSip": false,
        "supportGateStop": true,
        "supportShowInterfaceImage": true,
        "supportShowStatusBar": true,
        "supportShowHeading": true,
        "isFloodlightTriggerEnabled": false,
        "stats": {

          "video": {

            "recordingStart": 1784220871786,
            "recordingEnd": 1786606531989,
            "recordingStartLQ": 1784210492601,
            "recordingEndLQ": 1786606532010
          }
        },
        "location": [],
        "configs": [
          {

            "device_id": "00000000000000000000000c",
            "key": "capture_enable",
            "value": "yes",
            "tag": "device_extra",
            "update_time": "0001-01-01T00:00:00Z",
            "create_time": "0001-01-01T00:00:00Z"
          },
          {

            "device_id": "00000000000000000000000c",
            "key": "capture",
            "value": "yes",
            "tag": "device_extra",
            "update_time": "0001-01-01T00:00:00Z",
            "create_time": "0001-01-01T00:00:00Z"
          },
          {

            "device_id": "00000000000000000000000c",
            "key": "door_entry_method",
            "value": "in",
            "tag": "door_entry_method",
            "update_time": "0001-01-01T00:00:00Z",
            "create_time": "0001-01-01T00:00:00Z"
          }
        ],
        "support_feature": [
          "capture"
        ],
        "bind_same_paired": false,
        "accessDetectZones": [],
        "isAccessReader": false
      }
    }
  },
  {

    "event": "access.data.v2.device.update",
    "receiver_id": "",
    "event_object_id": "00000000-0000-0000-0000-00000000003f",
    "save_to_history": false,
    "data": {

      "name": "Test Name 65",
      "alias": "",
      "id": "00000000000000000000000c",
      "ip": "192.0.2.13",
      "mac": "AABBCC000010",
      "online": true,
      "adopting": false,
      "device_type": "UVC G6 Pro Entry",
      "connected_hub_id": "",
      "location_id": "",
      "firmware": "5.3.95",
      "version": "",
      "guid": "00000000-0000-0000-0000-000000000034",
      "start_time": 1782282073046,
      "hw_type": "",
      "revision": "",
      "cap": [
        "capture",
        "support_register_card"
      ],
      "category": [
        "camera"
      ]
    },
    "meta": {

      "object_type": "device",
      "target_field": null,
      "all_field": true,
      "id": "00000000000000000000000c",
      "source": ""
    }
  },
  {

    "event": "access.data.v2.device.update",
    "receiver_id": "",
    "event_object_id": "00000000-0000-0000-0000-000000000040",
    "save_to_history": false,
    "data": {

      "name": "Test Name 20",
      "alias": "Test alias 77",
      "id": "aabbcc000003",
      "ip": "192.0.2.4",
      "mac": "aa:bb:cc:00:00:03",
      "online": true,
      "adopting": false,
      "device_type": "UA-G2-MINI",
      "connected_hub_id": "aabbcc000001",
      "location_id": "00000000-0000-0000-0000-000000000006",
      "firmware": "v3.18.21.0",
      "version": "v3.18.21.0",
      "guid": "00000000-0000-0000-0000-00000000000d",
      "start_time": 1783874602,
      "hw_type": "GA",
      "revision": "1786095367040183648",
      "cap": null,
      "direction": "exit",
      "category": [
        "ua-lite"
      ]
    },
    "meta": {

      "object_type": "device",
      "target_field": [
        "online"
      ],
      "all_field": false,
      "id": "aabbcc000003",
      "source": ""
    }
  },
  {

    "event": "access.data.v2.device.update",
    "receiver_id": "",
    "event_object_id": "00000000-0000-0000-0000-000000000041",
    "save_to_history": false,
    "data": {

      "name": "Test Name 20",
      "alias": "Test alias 77",
      "id": "aabbcc000003",
      "ip": "192.0.2.4",
      "mac": "aa:bb:cc:00:00:03",
      "online": true,
      "adopting": false,
      "device_type": "UA-G2-MINI",
      "connected_hub_id": "aabbcc000001",
      "location_id": "00000000-0000-0000-0000-000000000006",
      "firmware": "v3.18.21.0",
      "version": "v3.18.21.0",
      "guid": "00000000-0000-0000-0000-00000000000d",
      "start_time": 1783874602,
      "hw_type": "GA",
      "revision": "1786095367040183648",
      "cap": null,
      "direction": "exit",
      "category": [
        "ua-lite"
      ]
    },
    "meta": {

      "object_type": "device",
      "target_field": [
        "online"
      ],
      "all_field": false,
      "id": "aabbcc000003",
      "source": ""
    }
  },
  {

    "event": "access.data.v2.device.update",
    "receiver_id": "",
    "event_object_id": "00000000-0000-0000-0000-000000000042",
    "save_to_history": false,
    "data": {

      "name": "Test Name 76",
      "alias": "Test alias 13",
      "id": "aabbcc000001",
      "ip": "192.0.2.2",
      "mac": "aa:bb:cc:00:00:01",
      "online": true,
      "adopting": false,
      "device_type": "UAH",
      "connected_hub_id": "",
      "location_id": "00000000-0000-0000-0000-000000000006",
      "firmware": "v4.12.19.0",
      "version": "v4.12.195",
      "guid": "00000000-0000-0000-0000-000000000007",
      "start_time": 1780317315,
      "hw_type": "",
      "revision": "1786095367040183648",
      "cap": null,
      "category": [
        "hub"
      ]
    },
    "meta": {

      "object_type": "device",
      "target_field": [
        "online"
      ],
      "all_field": false,
      "id": "aabbcc000001",
      "source": ""
    }
  },
  {

    "event": "access.data.v2.device.update",
    "receiver_id": "",
    "event_object_id": "00000000-0000-0000-0000-000000000043",
    "save_to_history": false,
    "data": {

      "name": "Test Name 68",
      "alias": "Test alias 75",
      "id": "aabbcc000002",
      "ip": "192.0.2.3",
      "mac": "aa:bb:cc:00:00:02",
      "online": true,
      "adopting": false,
      "device_type": "UA-G2-PRO",
      "connected_hub_id": "aabbcc000001",
      "location_id": "00000000-0000-0000-0000-000000000006",
      "firmware": "v1.14.17.0",
      "version": "v3.14.4552",
      "guid": "00000000-0000-0000-0000-000000000009",
      "start_time": 1784045238,
      "hw_type": "GA",
      "revision": "1786095367040183648",
      "cap": null,
      "direction": "entry",
      "category": [
        "ua-pro"
      ]
    },
    "meta": {

      "object_type": "device",
      "target_field": [
        "online"
      ],
      "all_field": false,
      "id": "aabbcc000002",
      "source": ""
    }
  },
  {

    "event": "access.data.camera.update",
    "receiver_id": "",
    "event_object_id": "00000000000000000000000c",
    "save_to_history": false,
    "data": {

      "mac": "AABBCC000010",
      "ip": "192.0.2.13",
      "name": "Test Name 65",
      "status": "online",
      "firmwareStatus": "upToDate",
      "firmware": "5.3.95",
      "startupTime": 1782282073076,
      "model": "G6 Pro Entry",
      "shortname": "Test shortname 66",
      "isManaged": true,
      "isAdopted": true,
      "isConnected": true,
      "metadata": {

        "deviceType": "camera",
        "uniqueId": "00000000000000000000000c"
      },
      "guid": "00000000-0000-0000-0000-000000000034",
      "images": {

        "xs": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_25x25.png",
        "s": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_32x32.png",
        "m": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_51x51.png",
        "l": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_64x64.png",
        "xl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_101x101.png",
        "xxl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_128x128.png",
        "animation": [
          "icons/g6-pro-entry-close.png",
          "icons/g6-pro-entry-open.png"
        ]
      },
      "source": "protect",
      "uniqueId": "00000000000000000000000c",
      "type": "UVC G6 Pro Entry",
      "supportLicensePlate": true,
      "supportDetectLPOnly": true,
      "videoWidth": 3024,
      "videoHeight": 4096,
      "videoCodec": "h265",
      "lastSeen": 1786606565076,
      "hubMac": "",
      "smartDetectZones": [
        {

          "id": 10001,
          "name": "Test Name 17",
          "color": "#AB46BC",
          "points": [
            [
              0,
              0
            ],
            [
              1,
              0
            ],
            [
              1,
              1
            ],
            [
              0,
              1
            ]
          ],
          "sensitivity": 50,
          "objectTypes": [
            "person",
            "vehicle",
            "animal",
            "face",
            "licensePlate"
          ],
          "isTriggerLightEnabled": true,
          "triggerAccessTypes": [],
          "source": "unifi-access",
          "enableAccessLPOnlyMode": false
        }
      ],
      "allSmartDetectZones": [
        {

          "id": 1,
          "name": "Test Name 67",
          "color": "#AB46BC",
          "points": [
            [
              0,
              0
            ],
            [
              1,
              0
            ],
            [
              1,
              1
            ],
            [
              0,
              1
            ]
          ],
          "sensitivity": 50,
          "objectTypes": [
            "person",
            "vehicle",
            "animal",
            "face"
          ],
          "isTriggerLightEnabled": true,
          "triggerAccessTypes": [],
          "source": "unifi-protect",
          "enableAccessLPOnlyMode": false
        }
      ],
      "smartDetectSettings": {

        "objectTypes": [
          "person",
          "vehicle",
          "animal",
          "package",
          "face",
          "licensePlate"
        ],
        "autoTrackingObjectTypes": [],
        "autoTrackingWithZoom": true,
        "audioTypes": [
          "alrmSmoke",
          "alrmCmonx",
          "alrmSiren",
          "alrmBabyCry",
          "alrmSpeak",
          "alrmBurglar",
          "alrmCarHorn",
          "alrmBark",
          "alrmGlassBreak"
        ],
        "enableTamperDetection": false,
        "detectionRange": {

          "max": 0,
          "min": 0
        }
      },
      "supportDoorAccessConfig": true,
      "recordingSettings": {

        "mode": "always",
        "prePaddingSecs": 2,
        "postPaddingSecs": 2,
        "smartDetectPrePaddingSecs": 2,
        "smartDetectPostPaddingSecs": 2,
        "minMotionEventTrigger": 1000,
        "endMotionEventDelay": 3000,
        "suppressIlluminationSurge": false,
        "inScheduleMode": "always",
        "outScheduleMode": "never",
        "geofencing": "off",
        "motionAlgorithm": "enhanced",
        "enableMotionDetection": false,
        "createAccessEvent": true,
        "useNewMotionAlgorithm": true
      },
      "osdSettings": {

        "isNameEnabled": false,
        "isDateEnabled": true,
        "isLogoEnabled": false,
        "isDebugEnabled": false
      },
      "micVolume": 100,
      "isMicEnabled": true,
      "talkbackSettings": {

        "bindAddr": "192.0.2.14",
        "bindPort": 7004,
        "bitsPerSample": 16,
        "channels": 1,
        "filterAddr": "",
        "filterPort": 0,
        "quality": 100,
        "samplingRate": 22050,
        "typeFmt": "aac",
        "typeIn": "serverudp"
      },
      "hasSpeaker": true,
      "isWaterproofCaseAttached": false,
      "ispSettings": {

        "aeMode": "auto",
        "irLedMode": "auto",
        "irLedLevel": 255,
        "wdr": 1,
        "icrSensitivity": 0,
        "icrSwitchMode": "sensitivity",
        "icrCustomValue": 1,
        "brightness": 50,
        "contrast": 50,
        "hue": 50,
        "saturation": 50,
        "sharpness": 50,
        "denoise": 50,
        "isColorNightVisionEnabled": true,
        "spotlightDuration": 15,
        "isFlippedVertical": false,
        "isFlippedHorizontal": false,
        "isAutoRotateEnabled": false,
        "isLdcEnabled": true,
        "is3dnrEnabled": true,
        "isExternalIrEnabled": false,
        "isAggressiveAntiFlickerEnabled": false,
        "isPauseMotionEnabled": false,
        "dZoomCenterX": 50,
        "dZoomCenterY": 50,
        "dZoomScale": 0,
        "dZoomStreamId": 4,
        "focusPosition": 0,
        "touchFocusX": 1001,
        "touchFocusY": 1001,
        "zoomPosition": 0,
        "mountPosition": "ceiling",
        "hdrMode": "normal",
        "sceneMode": "auto",
        "isSmokeCoverModeEnabled": false
      },
      "isPoorNetwork": false,
      "featureFlags": {

        "smartDetectTypes": [
          "person",
          "vehicle",
          "animal",
          "package",
          "face",
          "licensePlate"
        ],
        "supportDoorAccessConfig": true,
        "supportNfc": false,
        "supportLpOnly": false,
        "supportLpDetectionWithoutVehicle": true,
        "hasMic": true,
        "hasPackageCamera": true,
        "hasPackageZoneSupportForSecondaryLens": true,
        "canOpticalZoom": false,
        "hotPlug": {

          "audio": null
        },
        "reader": {

          "supportAccessMethods": [
            "nfc",
            "touchPass",
            "pinCode",
            "btButton",
            "btTap",
            "face",
            "qrCode"
          ],
          "support2fa": false,
          "supportLocate": true,
          "supportDoorDirection": true,
          "supportCallerManager": true,
          "supportInterfaceDirectory": true,
          "supportGreetings": true,
          "supportShowInterfaceImage": true,
          "supportShowStatusBar": true,
          "supportShowHeading": true,
          "supportGateStop": true
        }
      },
      "currentResolution": "5K",
      "supportNfc": true,
      "supportTouchPass": true,
      "supportFaceUnlock": true,
      "supportBtButton": true,
      "supportBtTap": true,
      "supportQrCode": true,
      "supportPIN": true,
      "supportTwoStepAuth": false,
      "supportGreeting": true,
      "supportDirection": false,
      "supportCallerManager": true,
      "supportMobileUnlockV2": true,
      "supportCallerDirectory": true,
      "supportTwilioSip": false,
      "supportGateStop": true,
      "supportShowInterfaceImage": true,
      "supportShowStatusBar": true,
      "supportShowHeading": true,
      "isFloodlightTriggerEnabled": false,
      "stats": {

        "video": {

          "recordingStart": 1784222131742,
          "recordingEnd": 1786606581647,
          "recordingStartLQ": 1784210492601,
          "recordingEndLQ": 1786606581666
        }
      },
      "location": [],
      "configs": [
        {

          "device_id": "00000000000000000000000c",
          "key": "capture_enable",
          "value": "yes",
          "tag": "device_extra",
          "update_time": "0001-01-01T00:00:00Z",
          "create_time": "0001-01-01T00:00:00Z"
        },
        {

          "device_id": "00000000000000000000000c",
          "key": "capture",
          "value": "yes",
          "tag": "device_extra",
          "update_time": "0001-01-01T00:00:00Z",
          "create_time": "0001-01-01T00:00:00Z"
        },
        {

          "device_id": "00000000000000000000000c",
          "key": "door_entry_method",
          "value": "in",
          "tag": "door_entry_method",
          "update_time": "0001-01-01T00:00:00Z",
          "create_time": "0001-01-01T00:00:00Z"
        }
      ],
      "support_feature": [
        "capture"
      ],
      "bind_same_paired": false,
      "accessDetectZones": [],
      "isAccessReader": false
    }
  },
  {

    "event": "access.data.device.update",
    "receiver_id": "",
    "event_object_id": "00000000000000000000000c",
    "save_to_history": false,
    "data": {

      "unique_id": "00000000000000000000000c",
      "name": "Test Name 65",
      "alias": "",
      "device_type": "UVC G6 Pro Entry",
      "connected_uah_id": "",
      "location_id": "",
      "firmware": "5.3.95",
      "version": "5.3.95",
      "ip": "192.0.2.13",
      "mac": "aa:bb:cc:00:00:10",
      "hw_type": "",
      "start_time": 1782282073,
      "last_seen": null,
      "security_check": null,
      "source": null,
      "bom_rev": null,
      "guid": "00000000-0000-0000-0000-000000000034",
      "need_advisory": null,
      "is_camera": true,
      "resource_name": "",
      "revision": null,
      "revision_update_time": null,
      "version_update_time": null,
      "firmware_update_time": null,
      "adopt_time": null,
      "location": null,
      "configs": [
        {

          "device_id": "00000000000000000000000c",
          "key": "capture_enable",
          "value": "yes",
          "tag": "device_extra",
          "update_time": "0001-01-01T00:00:00Z",
          "create_time": "0001-01-01T00:00:00Z"
        },
        {

          "device_id": "00000000000000000000000c",
          "key": "capture",
          "value": "yes",
          "tag": "device_extra",
          "update_time": "0001-01-01T00:00:00Z",
          "create_time": "0001-01-01T00:00:00Z"
        },
        {

          "device_id": "00000000000000000000000c",
          "key": "door_entry_method",
          "value": "in",
          "tag": "door_entry_method",
          "update_time": "0001-01-01T00:00:00Z",
          "create_time": "0001-01-01T00:00:00Z"
        }
      ],
      "is_connected": true,
      "is_online": true,
      "is_revision_up_to_date": false,
      "is_adopted": true,
      "is_managed": true,
      "is_upgrade_blocked": false,
      "is_export_sf_blocked": false,
      "is_rebooting": false,
      "update": null,
      "capabilities": [
        "support_register_card",
        "nfc_card_easy_provision",
        "support_mobile_unlock",
        "support_apple_pass",
        "show_face_method",
        "support_inhouse_sdk",
        "anti_spoofing_level",
        "support_face_sensitivity",
        "pin_code",
        "qr_code",
        "support_greeting",
        "support_caller_manager",
        "support_directory_direct",
        "support_show_interface_image",
        "support_show_status_bar",
        "support_show_heading",
        "identity_unlock_control_cmd",
        "support_ems",
        "doorbell_timeout",
        "doorbell_bind",
        "identity_support_ems",
        "identity_remote_view",
        "identity_face_unlock",
        "identity_is_camera",
        "support_record_hq_stream",
        "keypad_layout"
      ],
      "template": null,
      "images": {

        "xs": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_25x25.png",
        "s": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_32x32.png",
        "m": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_51x51.png",
        "l": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_64x64.png",
        "xl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_101x101.png",
        "xxl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_128x128.png",
        "animation": [
          "icons/g6-pro-entry-close.png",
          "icons/g6-pro-entry-open.png"
        ]
      },
      "camera_resource": {

        "mac": "AABBCC000010",
        "ip": "192.0.2.13",
        "name": "Test Name 65",
        "status": "online",
        "firmwareStatus": "upToDate",
        "firmware": "5.3.95",
        "startupTime": 1782282073076,
        "model": "G6 Pro Entry",
        "shortname": "Test shortname 66",
        "isManaged": true,
        "isAdopted": true,
        "isConnected": true,
        "metadata": {

          "deviceType": "camera",
          "uniqueId": "00000000000000000000000c"
        },
        "guid": "00000000-0000-0000-0000-000000000034",
        "images": {

          "xs": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_25x25.png",
          "s": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_32x32.png",
          "m": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_51x51.png",
          "l": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_64x64.png",
          "xl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_101x101.png",
          "xxl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_128x128.png",
          "animation": [
            "icons/g6-pro-entry-close.png",
            "icons/g6-pro-entry-open.png"
          ]
        },
        "source": "protect",
        "uniqueId": "00000000000000000000000c",
        "type": "UVC G6 Pro Entry",
        "supportLicensePlate": true,
        "supportDetectLPOnly": true,
        "videoWidth": 3024,
        "videoHeight": 4096,
        "videoCodec": "h265",
        "lastSeen": 1786606565076,
        "hubMac": "",
        "smartDetectZones": [
          {

            "id": 10001,
            "name": "Test Name 17",
            "color": "#AB46BC",
            "points": [
              [
                0,
                0
              ],
              [
                1,
                0
              ],
              [
                1,
                1
              ],
              [
                0,
                1
              ]
            ],
            "sensitivity": 50,
            "objectTypes": [
              "person",
              "vehicle",
              "animal",
              "face",
              "licensePlate"
            ],
            "isTriggerLightEnabled": true,
            "triggerAccessTypes": [],
            "source": "unifi-access",
            "enableAccessLPOnlyMode": false
          }
        ],
        "allSmartDetectZones": [
          {

            "id": 1,
            "name": "Test Name 67",
            "color": "#AB46BC",
            "points": [
              [
                0,
                0
              ],
              [
                1,
                0
              ],
              [
                1,
                1
              ],
              [
                0,
                1
              ]
            ],
            "sensitivity": 50,
            "objectTypes": [
              "person",
              "vehicle",
              "animal",
              "face"
            ],
            "isTriggerLightEnabled": true,
            "triggerAccessTypes": [],
            "source": "unifi-protect",
            "enableAccessLPOnlyMode": false
          }
        ],
        "smartDetectSettings": {

          "objectTypes": [
            "person",
            "vehicle",
            "animal",
            "package",
            "face",
            "licensePlate"
          ],
          "autoTrackingObjectTypes": [],
          "autoTrackingWithZoom": true,
          "audioTypes": [
            "alrmSmoke",
            "alrmCmonx",
            "alrmSiren",
            "alrmBabyCry",
            "alrmSpeak",
            "alrmBurglar",
            "alrmCarHorn",
            "alrmBark",
            "alrmGlassBreak"
          ],
          "enableTamperDetection": false,
          "detectionRange": {

            "max": 0,
            "min": 0
          }
        },
        "supportDoorAccessConfig": true,
        "recordingSettings": {

          "mode": "always",
          "prePaddingSecs": 2,
          "postPaddingSecs": 2,
          "smartDetectPrePaddingSecs": 2,
          "smartDetectPostPaddingSecs": 2,
          "minMotionEventTrigger": 1000,
          "endMotionEventDelay": 3000,
          "suppressIlluminationSurge": false,
          "inScheduleMode": "always",
          "outScheduleMode": "never",
          "geofencing": "off",
          "motionAlgorithm": "enhanced",
          "enableMotionDetection": false,
          "createAccessEvent": true,
          "useNewMotionAlgorithm": true
        },
        "osdSettings": {

          "isNameEnabled": false,
          "isDateEnabled": true,
          "isLogoEnabled": false,
          "isDebugEnabled": false
        },
        "micVolume": 100,
        "isMicEnabled": true,
        "talkbackSettings": {

          "bindAddr": "192.0.2.14",
          "bindPort": 7004,
          "bitsPerSample": 16,
          "channels": 1,
          "filterAddr": "",
          "filterPort": 0,
          "quality": 100,
          "samplingRate": 22050,
          "typeFmt": "aac",
          "typeIn": "serverudp"
        },
        "hasSpeaker": true,
        "isWaterproofCaseAttached": false,
        "ispSettings": {

          "aeMode": "auto",
          "irLedMode": "auto",
          "irLedLevel": 255,
          "wdr": 1,
          "icrSensitivity": 0,
          "icrSwitchMode": "sensitivity",
          "icrCustomValue": 1,
          "brightness": 50,
          "contrast": 50,
          "hue": 50,
          "saturation": 50,
          "sharpness": 50,
          "denoise": 50,
          "isColorNightVisionEnabled": true,
          "spotlightDuration": 15,
          "isFlippedVertical": false,
          "isFlippedHorizontal": false,
          "isAutoRotateEnabled": false,
          "isLdcEnabled": true,
          "is3dnrEnabled": true,
          "isExternalIrEnabled": false,
          "isAggressiveAntiFlickerEnabled": false,
          "isPauseMotionEnabled": false,
          "dZoomCenterX": 50,
          "dZoomCenterY": 50,
          "dZoomScale": 0,
          "dZoomStreamId": 4,
          "focusPosition": 0,
          "touchFocusX": 1001,
          "touchFocusY": 1001,
          "zoomPosition": 0,
          "mountPosition": "ceiling",
          "hdrMode": "normal",
          "sceneMode": "auto",
          "isSmokeCoverModeEnabled": false
        },
        "isPoorNetwork": false,
        "featureFlags": {

          "smartDetectTypes": [
            "person",
            "vehicle",
            "animal",
            "package",
            "face",
            "licensePlate"
          ],
          "supportDoorAccessConfig": true,
          "supportNfc": false,
          "supportLpOnly": false,
          "supportLpDetectionWithoutVehicle": true,
          "hasMic": true,
          "hasPackageCamera": true,
          "hasPackageZoneSupportForSecondaryLens": true,
          "canOpticalZoom": false,
          "hotPlug": {

            "audio": null
          },
          "reader": {

            "supportAccessMethods": [
              "nfc",
              "touchPass",
              "pinCode",
              "btButton",
              "btTap",
              "face",
              "qrCode"
            ],
            "support2fa": false,
            "supportLocate": true,
            "supportDoorDirection": true,
            "supportCallerManager": true,
            "supportInterfaceDirectory": true,
            "supportGreetings": true,
            "supportShowInterfaceImage": true,
            "supportShowStatusBar": true,
            "supportShowHeading": true,
            "supportGateStop": true
          }
        },
        "currentResolution": "5K",
        "supportNfc": true,
        "supportTouchPass": true,
        "supportFaceUnlock": true,
        "supportBtButton": true,
        "supportBtTap": true,
        "supportQrCode": true,
        "supportPIN": true,
        "supportTwoStepAuth": false,
        "supportGreeting": true,
        "supportDirection": false,
        "supportCallerManager": true,
        "supportMobileUnlockV2": true,
        "supportCallerDirectory": true,
        "supportTwilioSip": false,
        "supportGateStop": true,
        "supportShowInterfaceImage": true,
        "supportShowStatusBar": true,
        "supportShowHeading": true,
        "isFloodlightTriggerEnabled": false,
        "stats": {

          "video": {

            "recordingStart": 1784222131742,
            "recordingEnd": 1786606581647,
            "recordingStartLQ": 1784210492601,
            "recordingEndLQ": 1786606581666
          }
        },
        "location": [],
        "configs": [
          {

            "device_id": "00000000000000000000000c",
            "key": "capture_enable",
            "value": "yes",
            "tag": "device_extra",
            "update_time": "0001-01-01T00:00:00Z",
            "create_time": "0001-01-01T00:00:00Z"
          },
          {

            "device_id": "00000000000000000000000c",
            "key": "capture",
            "value": "yes",
            "tag": "device_extra",
            "update_time": "0001-01-01T00:00:00Z",
            "create_time": "0001-01-01T00:00:00Z"
          },
          {

            "device_id": "00000000000000000000000c",
            "key": "door_entry_method",
            "value": "in",
            "tag": "door_entry_method",
            "update_time": "0001-01-01T00:00:00Z",
            "create_time": "0001-01-01T00:00:00Z"
          }
        ],
        "support_feature": [
          "capture"
        ],
        "bind_same_paired": false,
        "accessDetectZones": [],
        "isAccessReader": false
      }
    }
  },
  {

    "event": "access.data.v2.device.update",
    "receiver_id": "",
    "event_object_id": "00000000-0000-0000-0000-000000000044",
    "save_to_history": false,
    "data": {

      "name": "Test Name 65",
      "alias": "",
      "id": "00000000000000000000000c",
      "ip": "192.0.2.13",
      "mac": "AABBCC000010",
      "online": true,
      "adopting": false,
      "device_type": "UVC G6 Pro Entry",
      "connected_hub_id": "",
      "location_id": "",
      "firmware": "5.3.95",
      "version": "",
      "guid": "00000000-0000-0000-0000-000000000034",
      "start_time": 1782282073076,
      "hw_type": "",
      "revision": "",
      "cap": [
        "capture",
        "support_register_card"
      ],
      "category": [
        "camera"
      ]
    },
    "meta": {

      "object_type": "device",
      "target_field": null,
      "all_field": true,
      "id": "00000000000000000000000c",
      "source": ""
    }
  },
  {

    "event": "access.data.camera.update",
    "receiver_id": "",
    "event_object_id": "00000000000000000000000c",
    "save_to_history": false,
    "data": {

      "mac": "AABBCC000010",
      "ip": "192.0.2.13",
      "name": "Test Name 65",
      "status": "online",
      "firmwareStatus": "upToDate",
      "firmware": "5.3.95",
      "startupTime": 1782282073045,
      "model": "G6 Pro Entry",
      "shortname": "Test shortname 66",
      "isManaged": true,
      "isAdopted": true,
      "isConnected": true,
      "metadata": {

        "deviceType": "camera",
        "uniqueId": "00000000000000000000000c"
      },
      "guid": "00000000-0000-0000-0000-000000000034",
      "images": {

        "xs": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_25x25.png",
        "s": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_32x32.png",
        "m": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_51x51.png",
        "l": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_64x64.png",
        "xl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_101x101.png",
        "xxl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_128x128.png",
        "animation": [
          "icons/g6-pro-entry-close.png",
          "icons/g6-pro-entry-open.png"
        ]
      },
      "source": "protect",
      "uniqueId": "00000000000000000000000c",
      "type": "UVC G6 Pro Entry",
      "supportLicensePlate": true,
      "supportDetectLPOnly": true,
      "videoWidth": 3024,
      "videoHeight": 4096,
      "videoCodec": "h265",
      "lastSeen": 1786606625045,
      "hubMac": "",
      "smartDetectZones": [
        {

          "id": 10001,
          "name": "Test Name 17",
          "color": "#AB46BC",
          "points": [
            [
              0,
              0
            ],
            [
              1,
              0
            ],
            [
              1,
              1
            ],
            [
              0,
              1
            ]
          ],
          "sensitivity": 50,
          "objectTypes": [
            "person",
            "vehicle",
            "animal",
            "face",
            "licensePlate"
          ],
          "isTriggerLightEnabled": true,
          "triggerAccessTypes": [],
          "source": "unifi-access",
          "enableAccessLPOnlyMode": false
        }
      ],
      "allSmartDetectZones": [
        {

          "id": 1,
          "name": "Test Name 67",
          "color": "#AB46BC",
          "points": [
            [
              0,
              0
            ],
            [
              1,
              0
            ],
            [
              1,
              1
            ],
            [
              0,
              1
            ]
          ],
          "sensitivity": 50,
          "objectTypes": [
            "person",
            "vehicle",
            "animal",
            "face"
          ],
          "isTriggerLightEnabled": true,
          "triggerAccessTypes": [],
          "source": "unifi-protect",
          "enableAccessLPOnlyMode": false
        }
      ],
      "smartDetectSettings": {

        "objectTypes": [
          "person",
          "vehicle",
          "animal",
          "package",
          "face",
          "licensePlate"
        ],
        "autoTrackingObjectTypes": [],
        "autoTrackingWithZoom": true,
        "audioTypes": [
          "alrmSmoke",
          "alrmCmonx",
          "alrmSiren",
          "alrmBabyCry",
          "alrmSpeak",
          "alrmBurglar",
          "alrmCarHorn",
          "alrmBark",
          "alrmGlassBreak"
        ],
        "enableTamperDetection": false,
        "detectionRange": {

          "max": 0,
          "min": 0
        }
      },
      "supportDoorAccessConfig": true,
      "recordingSettings": {

        "mode": "always",
        "prePaddingSecs": 2,
        "postPaddingSecs": 2,
        "smartDetectPrePaddingSecs": 2,
        "smartDetectPostPaddingSecs": 2,
        "minMotionEventTrigger": 1000,
        "endMotionEventDelay": 3000,
        "suppressIlluminationSurge": false,
        "inScheduleMode": "always",
        "outScheduleMode": "never",
        "geofencing": "off",
        "motionAlgorithm": "enhanced",
        "enableMotionDetection": false,
        "createAccessEvent": true,
        "useNewMotionAlgorithm": true
      },
      "osdSettings": {

        "isNameEnabled": false,
        "isDateEnabled": true,
        "isLogoEnabled": false,
        "isDebugEnabled": false
      },
      "micVolume": 100,
      "isMicEnabled": true,
      "talkbackSettings": {

        "bindAddr": "192.0.2.14",
        "bindPort": 7004,
        "bitsPerSample": 16,
        "channels": 1,
        "filterAddr": "",
        "filterPort": 0,
        "quality": 100,
        "samplingRate": 22050,
        "typeFmt": "aac",
        "typeIn": "serverudp"
      },
      "hasSpeaker": true,
      "isWaterproofCaseAttached": false,
      "ispSettings": {

        "aeMode": "auto",
        "irLedMode": "auto",
        "irLedLevel": 255,
        "wdr": 1,
        "icrSensitivity": 0,
        "icrSwitchMode": "sensitivity",
        "icrCustomValue": 1,
        "brightness": 50,
        "contrast": 50,
        "hue": 50,
        "saturation": 50,
        "sharpness": 50,
        "denoise": 50,
        "isColorNightVisionEnabled": true,
        "spotlightDuration": 15,
        "isFlippedVertical": false,
        "isFlippedHorizontal": false,
        "isAutoRotateEnabled": false,
        "isLdcEnabled": true,
        "is3dnrEnabled": true,
        "isExternalIrEnabled": false,
        "isAggressiveAntiFlickerEnabled": false,
        "isPauseMotionEnabled": false,
        "dZoomCenterX": 50,
        "dZoomCenterY": 50,
        "dZoomScale": 0,
        "dZoomStreamId": 4,
        "focusPosition": 0,
        "touchFocusX": 1001,
        "touchFocusY": 1001,
        "zoomPosition": 0,
        "mountPosition": "ceiling",
        "hdrMode": "normal",
        "sceneMode": "auto",
        "isSmokeCoverModeEnabled": false
      },
      "isPoorNetwork": false,
      "featureFlags": {

        "smartDetectTypes": [
          "person",
          "vehicle",
          "animal",
          "package",
          "face",
          "licensePlate"
        ],
        "supportDoorAccessConfig": true,
        "supportNfc": false,
        "supportLpOnly": false,
        "supportLpDetectionWithoutVehicle": true,
        "hasMic": true,
        "hasPackageCamera": true,
        "hasPackageZoneSupportForSecondaryLens": true,
        "canOpticalZoom": false,
        "hotPlug": {

          "audio": null
        },
        "reader": {

          "supportAccessMethods": [
            "nfc",
            "touchPass",
            "pinCode",
            "btButton",
            "btTap",
            "face",
            "qrCode"
          ],
          "support2fa": false,
          "supportLocate": true,
          "supportDoorDirection": true,
          "supportCallerManager": true,
          "supportInterfaceDirectory": true,
          "supportGreetings": true,
          "supportShowInterfaceImage": true,
          "supportShowStatusBar": true,
          "supportShowHeading": true,
          "supportGateStop": true
        }
      },
      "currentResolution": "5K",
      "supportNfc": true,
      "supportTouchPass": true,
      "supportFaceUnlock": true,
      "supportBtButton": true,
      "supportBtTap": true,
      "supportQrCode": true,
      "supportPIN": true,
      "supportTwoStepAuth": false,
      "supportGreeting": true,
      "supportDirection": false,
      "supportCallerManager": true,
      "supportMobileUnlockV2": true,
      "supportCallerDirectory": true,
      "supportTwilioSip": false,
      "supportGateStop": true,
      "supportShowInterfaceImage": true,
      "supportShowStatusBar": true,
      "supportShowHeading": true,
      "isFloodlightTriggerEnabled": false,
      "stats": {

        "video": {

          "recordingStart": 1784222131742,
          "recordingEnd": 1786606636275,
          "recordingStartLQ": 1784210492601,
          "recordingEndLQ": 1786606636291
        }
      },
      "location": [],
      "configs": [
        {

          "device_id": "00000000000000000000000c",
          "key": "capture_enable",
          "value": "yes",
          "tag": "device_extra",
          "update_time": "0001-01-01T00:00:00Z",
          "create_time": "0001-01-01T00:00:00Z"
        },
        {

          "device_id": "00000000000000000000000c",
          "key": "capture",
          "value": "yes",
          "tag": "device_extra",
          "update_time": "0001-01-01T00:00:00Z",
          "create_time": "0001-01-01T00:00:00Z"
        },
        {

          "device_id": "00000000000000000000000c",
          "key": "door_entry_method",
          "value": "in",
          "tag": "door_entry_method",
          "update_time": "0001-01-01T00:00:00Z",
          "create_time": "0001-01-01T00:00:00Z"
        }
      ],
      "support_feature": [
        "capture"
      ],
      "bind_same_paired": false,
      "accessDetectZones": [],
      "isAccessReader": false
    }
  },
  {

    "event": "access.data.device.update",
    "receiver_id": "",
    "event_object_id": "00000000000000000000000c",
    "save_to_history": false,
    "data": {

      "unique_id": "00000000000000000000000c",
      "name": "Test Name 65",
      "alias": "",
      "device_type": "UVC G6 Pro Entry",
      "connected_uah_id": "",
      "location_id": "",
      "firmware": "5.3.95",
      "version": "5.3.95",
      "ip": "192.0.2.13",
      "mac": "aa:bb:cc:00:00:10",
      "hw_type": "",
      "start_time": 1782282073,
      "last_seen": null,
      "security_check": null,
      "source": null,
      "bom_rev": null,
      "guid": "00000000-0000-0000-0000-000000000034",
      "need_advisory": null,
      "is_camera": true,
      "resource_name": "",
      "revision": null,
      "revision_update_time": null,
      "version_update_time": null,
      "firmware_update_time": null,
      "adopt_time": null,
      "location": null,
      "configs": [
        {

          "device_id": "00000000000000000000000c",
          "key": "capture_enable",
          "value": "yes",
          "tag": "device_extra",
          "update_time": "0001-01-01T00:00:00Z",
          "create_time": "0001-01-01T00:00:00Z"
        },
        {

          "device_id": "00000000000000000000000c",
          "key": "capture",
          "value": "yes",
          "tag": "device_extra",
          "update_time": "0001-01-01T00:00:00Z",
          "create_time": "0001-01-01T00:00:00Z"
        },
        {

          "device_id": "00000000000000000000000c",
          "key": "door_entry_method",
          "value": "in",
          "tag": "door_entry_method",
          "update_time": "0001-01-01T00:00:00Z",
          "create_time": "0001-01-01T00:00:00Z"
        }
      ],
      "is_connected": true,
      "is_online": true,
      "is_revision_up_to_date": false,
      "is_adopted": true,
      "is_managed": true,
      "is_upgrade_blocked": false,
      "is_export_sf_blocked": false,
      "is_rebooting": false,
      "update": null,
      "capabilities": [
        "support_register_card",
        "nfc_card_easy_provision",
        "support_mobile_unlock",
        "support_apple_pass",
        "show_face_method",
        "support_inhouse_sdk",
        "anti_spoofing_level",
        "support_face_sensitivity",
        "pin_code",
        "qr_code",
        "support_greeting",
        "support_caller_manager",
        "support_directory_direct",
        "support_show_interface_image",
        "support_show_status_bar",
        "support_show_heading",
        "identity_unlock_control_cmd",
        "support_ems",
        "doorbell_timeout",
        "doorbell_bind",
        "identity_support_ems",
        "identity_remote_view",
        "identity_face_unlock",
        "identity_is_camera",
        "support_record_hq_stream",
        "keypad_layout"
      ],
      "template": null,
      "images": {

        "xs": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_25x25.png",
        "s": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_32x32.png",
        "m": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_51x51.png",
        "l": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_64x64.png",
        "xl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_101x101.png",
        "xxl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_128x128.png",
        "animation": [
          "icons/g6-pro-entry-close.png",
          "icons/g6-pro-entry-open.png"
        ]
      },
      "camera_resource": {

        "mac": "AABBCC000010",
        "ip": "192.0.2.13",
        "name": "Test Name 65",
        "status": "online",
        "firmwareStatus": "upToDate",
        "firmware": "5.3.95",
        "startupTime": 1782282073045,
        "model": "G6 Pro Entry",
        "shortname": "Test shortname 66",
        "isManaged": true,
        "isAdopted": true,
        "isConnected": true,
        "metadata": {

          "deviceType": "camera",
          "uniqueId": "00000000000000000000000c"
        },
        "guid": "00000000-0000-0000-0000-000000000034",
        "images": {

          "xs": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_25x25.png",
          "s": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_32x32.png",
          "m": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_51x51.png",
          "l": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_64x64.png",
          "xl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_101x101.png",
          "xxl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_128x128.png",
          "animation": [
            "icons/g6-pro-entry-close.png",
            "icons/g6-pro-entry-open.png"
          ]
        },
        "source": "protect",
        "uniqueId": "00000000000000000000000c",
        "type": "UVC G6 Pro Entry",
        "supportLicensePlate": true,
        "supportDetectLPOnly": true,
        "videoWidth": 3024,
        "videoHeight": 4096,
        "videoCodec": "h265",
        "lastSeen": 1786606625045,
        "hubMac": "",
        "smartDetectZones": [
          {

            "id": 10001,
            "name": "Test Name 17",
            "color": "#AB46BC",
            "points": [
              [
                0,
                0
              ],
              [
                1,
                0
              ],
              [
                1,
                1
              ],
              [
                0,
                1
              ]
            ],
            "sensitivity": 50,
            "objectTypes": [
              "person",
              "vehicle",
              "animal",
              "face",
              "licensePlate"
            ],
            "isTriggerLightEnabled": true,
            "triggerAccessTypes": [],
            "source": "unifi-access",
            "enableAccessLPOnlyMode": false
          }
        ],
        "allSmartDetectZones": [
          {

            "id": 1,
            "name": "Test Name 67",
            "color": "#AB46BC",
            "points": [
              [
                0,
                0
              ],
              [
                1,
                0
              ],
              [
                1,
                1
              ],
              [
                0,
                1
              ]
            ],
            "sensitivity": 50,
            "objectTypes": [
              "person",
              "vehicle",
              "animal",
              "face"
            ],
            "isTriggerLightEnabled": true,
            "triggerAccessTypes": [],
            "source": "unifi-protect",
            "enableAccessLPOnlyMode": false
          }
        ],
        "smartDetectSettings": {

          "objectTypes": [
            "person",
            "vehicle",
            "animal",
            "package",
            "face",
            "licensePlate"
          ],
          "autoTrackingObjectTypes": [],
          "autoTrackingWithZoom": true,
          "audioTypes": [
            "alrmSmoke",
            "alrmCmonx",
            "alrmSiren",
            "alrmBabyCry",
            "alrmSpeak",
            "alrmBurglar",
            "alrmCarHorn",
            "alrmBark",
            "alrmGlassBreak"
          ],
          "enableTamperDetection": false,
          "detectionRange": {

            "max": 0,
            "min": 0
          }
        },
        "supportDoorAccessConfig": true,
        "recordingSettings": {

          "mode": "always",
          "prePaddingSecs": 2,
          "postPaddingSecs": 2,
          "smartDetectPrePaddingSecs": 2,
          "smartDetectPostPaddingSecs": 2,
          "minMotionEventTrigger": 1000,
          "endMotionEventDelay": 3000,
          "suppressIlluminationSurge": false,
          "inScheduleMode": "always",
          "outScheduleMode": "never",
          "geofencing": "off",
          "motionAlgorithm": "enhanced",
          "enableMotionDetection": false,
          "createAccessEvent": true,
          "useNewMotionAlgorithm": true
        },
        "osdSettings": {

          "isNameEnabled": false,
          "isDateEnabled": true,
          "isLogoEnabled": false,
          "isDebugEnabled": false
        },
        "micVolume": 100,
        "isMicEnabled": true,
        "talkbackSettings": {

          "bindAddr": "192.0.2.14",
          "bindPort": 7004,
          "bitsPerSample": 16,
          "channels": 1,
          "filterAddr": "",
          "filterPort": 0,
          "quality": 100,
          "samplingRate": 22050,
          "typeFmt": "aac",
          "typeIn": "serverudp"
        },
        "hasSpeaker": true,
        "isWaterproofCaseAttached": false,
        "ispSettings": {

          "aeMode": "auto",
          "irLedMode": "auto",
          "irLedLevel": 255,
          "wdr": 1,
          "icrSensitivity": 0,
          "icrSwitchMode": "sensitivity",
          "icrCustomValue": 1,
          "brightness": 50,
          "contrast": 50,
          "hue": 50,
          "saturation": 50,
          "sharpness": 50,
          "denoise": 50,
          "isColorNightVisionEnabled": true,
          "spotlightDuration": 15,
          "isFlippedVertical": false,
          "isFlippedHorizontal": false,
          "isAutoRotateEnabled": false,
          "isLdcEnabled": true,
          "is3dnrEnabled": true,
          "isExternalIrEnabled": false,
          "isAggressiveAntiFlickerEnabled": false,
          "isPauseMotionEnabled": false,
          "dZoomCenterX": 50,
          "dZoomCenterY": 50,
          "dZoomScale": 0,
          "dZoomStreamId": 4,
          "focusPosition": 0,
          "touchFocusX": 1001,
          "touchFocusY": 1001,
          "zoomPosition": 0,
          "mountPosition": "ceiling",
          "hdrMode": "normal",
          "sceneMode": "auto",
          "isSmokeCoverModeEnabled": false
        },
        "isPoorNetwork": false,
        "featureFlags": {

          "smartDetectTypes": [
            "person",
            "vehicle",
            "animal",
            "package",
            "face",
            "licensePlate"
          ],
          "supportDoorAccessConfig": true,
          "supportNfc": false,
          "supportLpOnly": false,
          "supportLpDetectionWithoutVehicle": true,
          "hasMic": true,
          "hasPackageCamera": true,
          "hasPackageZoneSupportForSecondaryLens": true,
          "canOpticalZoom": false,
          "hotPlug": {

            "audio": null
          },
          "reader": {

            "supportAccessMethods": [
              "nfc",
              "touchPass",
              "pinCode",
              "btButton",
              "btTap",
              "face",
              "qrCode"
            ],
            "support2fa": false,
            "supportLocate": true,
            "supportDoorDirection": true,
            "supportCallerManager": true,
            "supportInterfaceDirectory": true,
            "supportGreetings": true,
            "supportShowInterfaceImage": true,
            "supportShowStatusBar": true,
            "supportShowHeading": true,
            "supportGateStop": true
          }
        },
        "currentResolution": "5K",
        "supportNfc": true,
        "supportTouchPass": true,
        "supportFaceUnlock": true,
        "supportBtButton": true,
        "supportBtTap": true,
        "supportQrCode": true,
        "supportPIN": true,
        "supportTwoStepAuth": false,
        "supportGreeting": true,
        "supportDirection": false,
        "supportCallerManager": true,
        "supportMobileUnlockV2": true,
        "supportCallerDirectory": true,
        "supportTwilioSip": false,
        "supportGateStop": true,
        "supportShowInterfaceImage": true,
        "supportShowStatusBar": true,
        "supportShowHeading": true,
        "isFloodlightTriggerEnabled": false,
        "stats": {

          "video": {

            "recordingStart": 1784222131742,
            "recordingEnd": 1786606636275,
            "recordingStartLQ": 1784210492601,
            "recordingEndLQ": 1786606636291
          }
        },
        "location": [],
        "configs": [
          {

            "device_id": "00000000000000000000000c",
            "key": "capture_enable",
            "value": "yes",
            "tag": "device_extra",
            "update_time": "0001-01-01T00:00:00Z",
            "create_time": "0001-01-01T00:00:00Z"
          },
          {

            "device_id": "00000000000000000000000c",
            "key": "capture",
            "value": "yes",
            "tag": "device_extra",
            "update_time": "0001-01-01T00:00:00Z",
            "create_time": "0001-01-01T00:00:00Z"
          },
          {

            "device_id": "00000000000000000000000c",
            "key": "door_entry_method",
            "value": "in",
            "tag": "door_entry_method",
            "update_time": "0001-01-01T00:00:00Z",
            "create_time": "0001-01-01T00:00:00Z"
          }
        ],
        "support_feature": [
          "capture"
        ],
        "bind_same_paired": false,
        "accessDetectZones": [],
        "isAccessReader": false
      }
    }
  },
  {

    "event": "access.data.v2.device.update",
    "receiver_id": "",
    "event_object_id": "00000000-0000-0000-0000-000000000045",
    "save_to_history": false,
    "data": {

      "name": "Test Name 65",
      "alias": "",
      "id": "00000000000000000000000c",
      "ip": "192.0.2.13",
      "mac": "AABBCC000010",
      "online": true,
      "adopting": false,
      "device_type": "UVC G6 Pro Entry",
      "connected_hub_id": "",
      "location_id": "",
      "firmware": "5.3.95",
      "version": "",
      "guid": "00000000-0000-0000-0000-000000000034",
      "start_time": 1782282073045,
      "hw_type": "",
      "revision": "",
      "cap": [
        "capture",
        "support_register_card"
      ],
      "category": [
        "camera"
      ]
    },
    "meta": {

      "object_type": "device",
      "target_field": null,
      "all_field": true,
      "id": "00000000000000000000000c",
      "source": ""
    }
  },
  {

    "event": "access.data.camera.update",
    "receiver_id": "",
    "event_object_id": "00000000000000000000000c",
    "save_to_history": false,
    "data": {

      "mac": "AABBCC000010",
      "ip": "192.0.2.13",
      "name": "Test Name 65",
      "status": "online",
      "firmwareStatus": "upToDate",
      "firmware": "5.3.95",
      "startupTime": 1782282073022,
      "model": "G6 Pro Entry",
      "shortname": "Test shortname 66",
      "isManaged": true,
      "isAdopted": true,
      "isConnected": true,
      "metadata": {

        "deviceType": "camera",
        "uniqueId": "00000000000000000000000c"
      },
      "guid": "00000000-0000-0000-0000-000000000034",
      "images": {

        "xs": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_25x25.png",
        "s": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_32x32.png",
        "m": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_51x51.png",
        "l": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_64x64.png",
        "xl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_101x101.png",
        "xxl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_128x128.png",
        "animation": [
          "icons/g6-pro-entry-close.png",
          "icons/g6-pro-entry-open.png"
        ]
      },
      "source": "protect",
      "uniqueId": "00000000000000000000000c",
      "type": "UVC G6 Pro Entry",
      "supportLicensePlate": true,
      "supportDetectLPOnly": true,
      "videoWidth": 3024,
      "videoHeight": 4096,
      "videoCodec": "h265",
      "lastSeen": 1786606685022,
      "hubMac": "",
      "smartDetectZones": [
        {

          "id": 10001,
          "name": "Test Name 17",
          "color": "#AB46BC",
          "points": [
            [
              0,
              0
            ],
            [
              1,
              0
            ],
            [
              1,
              1
            ],
            [
              0,
              1
            ]
          ],
          "sensitivity": 50,
          "objectTypes": [
            "person",
            "vehicle",
            "animal",
            "face",
            "licensePlate"
          ],
          "isTriggerLightEnabled": true,
          "triggerAccessTypes": [],
          "source": "unifi-access",
          "enableAccessLPOnlyMode": false
        }
      ],
      "allSmartDetectZones": [
        {

          "id": 1,
          "name": "Test Name 67",
          "color": "#AB46BC",
          "points": [
            [
              0,
              0
            ],
            [
              1,
              0
            ],
            [
              1,
              1
            ],
            [
              0,
              1
            ]
          ],
          "sensitivity": 50,
          "objectTypes": [
            "person",
            "vehicle",
            "animal",
            "face"
          ],
          "isTriggerLightEnabled": true,
          "triggerAccessTypes": [],
          "source": "unifi-protect",
          "enableAccessLPOnlyMode": false
        }
      ],
      "smartDetectSettings": {

        "objectTypes": [
          "person",
          "vehicle",
          "animal",
          "package",
          "face",
          "licensePlate"
        ],
        "autoTrackingObjectTypes": [],
        "autoTrackingWithZoom": true,
        "audioTypes": [
          "alrmSmoke",
          "alrmCmonx",
          "alrmSiren",
          "alrmBabyCry",
          "alrmSpeak",
          "alrmBurglar",
          "alrmCarHorn",
          "alrmBark",
          "alrmGlassBreak"
        ],
        "enableTamperDetection": false,
        "detectionRange": {

          "max": 0,
          "min": 0
        }
      },
      "supportDoorAccessConfig": true,
      "recordingSettings": {

        "mode": "always",
        "prePaddingSecs": 2,
        "postPaddingSecs": 2,
        "smartDetectPrePaddingSecs": 2,
        "smartDetectPostPaddingSecs": 2,
        "minMotionEventTrigger": 1000,
        "endMotionEventDelay": 3000,
        "suppressIlluminationSurge": false,
        "inScheduleMode": "always",
        "outScheduleMode": "never",
        "geofencing": "off",
        "motionAlgorithm": "enhanced",
        "enableMotionDetection": false,
        "createAccessEvent": true,
        "useNewMotionAlgorithm": true
      },
      "osdSettings": {

        "isNameEnabled": false,
        "isDateEnabled": true,
        "isLogoEnabled": false,
        "isDebugEnabled": false
      },
      "micVolume": 100,
      "isMicEnabled": true,
      "talkbackSettings": {

        "bindAddr": "192.0.2.14",
        "bindPort": 7004,
        "bitsPerSample": 16,
        "channels": 1,
        "filterAddr": "",
        "filterPort": 0,
        "quality": 100,
        "samplingRate": 22050,
        "typeFmt": "aac",
        "typeIn": "serverudp"
      },
      "hasSpeaker": true,
      "isWaterproofCaseAttached": false,
      "ispSettings": {

        "aeMode": "auto",
        "irLedMode": "auto",
        "irLedLevel": 255,
        "wdr": 1,
        "icrSensitivity": 0,
        "icrSwitchMode": "sensitivity",
        "icrCustomValue": 1,
        "brightness": 50,
        "contrast": 50,
        "hue": 50,
        "saturation": 50,
        "sharpness": 50,
        "denoise": 50,
        "isColorNightVisionEnabled": true,
        "spotlightDuration": 15,
        "isFlippedVertical": false,
        "isFlippedHorizontal": false,
        "isAutoRotateEnabled": false,
        "isLdcEnabled": true,
        "is3dnrEnabled": true,
        "isExternalIrEnabled": false,
        "isAggressiveAntiFlickerEnabled": false,
        "isPauseMotionEnabled": false,
        "dZoomCenterX": 50,
        "dZoomCenterY": 50,
        "dZoomScale": 0,
        "dZoomStreamId": 4,
        "focusPosition": 0,
        "touchFocusX": 1001,
        "touchFocusY": 1001,
        "zoomPosition": 0,
        "mountPosition": "ceiling",
        "hdrMode": "normal",
        "sceneMode": "auto",
        "isSmokeCoverModeEnabled": false
      },
      "isPoorNetwork": false,
      "featureFlags": {

        "smartDetectTypes": [
          "person",
          "vehicle",
          "animal",
          "package",
          "face",
          "licensePlate"
        ],
        "supportDoorAccessConfig": true,
        "supportNfc": false,
        "supportLpOnly": false,
        "supportLpDetectionWithoutVehicle": true,
        "hasMic": true,
        "hasPackageCamera": true,
        "hasPackageZoneSupportForSecondaryLens": true,
        "canOpticalZoom": false,
        "hotPlug": {

          "audio": null
        },
        "reader": {

          "supportAccessMethods": [
            "nfc",
            "touchPass",
            "pinCode",
            "btButton",
            "btTap",
            "face",
            "qrCode"
          ],
          "support2fa": false,
          "supportLocate": true,
          "supportDoorDirection": true,
          "supportCallerManager": true,
          "supportInterfaceDirectory": true,
          "supportGreetings": true,
          "supportShowInterfaceImage": true,
          "supportShowStatusBar": true,
          "supportShowHeading": true,
          "supportGateStop": true
        }
      },
      "currentResolution": "5K",
      "supportNfc": true,
      "supportTouchPass": true,
      "supportFaceUnlock": true,
      "supportBtButton": true,
      "supportBtTap": true,
      "supportQrCode": true,
      "supportPIN": true,
      "supportTwoStepAuth": false,
      "supportGreeting": true,
      "supportDirection": false,
      "supportCallerManager": true,
      "supportMobileUnlockV2": true,
      "supportCallerDirectory": true,
      "supportTwilioSip": false,
      "supportGateStop": true,
      "supportShowInterfaceImage": true,
      "supportShowStatusBar": true,
      "supportShowHeading": true,
      "isFloodlightTriggerEnabled": false,
      "stats": {

        "video": {

          "recordingStart": 1784222131742,
          "recordingEnd": 1786606685934,
          "recordingStartLQ": 1784210492601,
          "recordingEndLQ": 1786606685944
        }
      },
      "location": [],
      "configs": [
        {

          "device_id": "00000000000000000000000c",
          "key": "capture_enable",
          "value": "yes",
          "tag": "device_extra",
          "update_time": "0001-01-01T00:00:00Z",
          "create_time": "0001-01-01T00:00:00Z"
        },
        {

          "device_id": "00000000000000000000000c",
          "key": "capture",
          "value": "yes",
          "tag": "device_extra",
          "update_time": "0001-01-01T00:00:00Z",
          "create_time": "0001-01-01T00:00:00Z"
        },
        {

          "device_id": "00000000000000000000000c",
          "key": "door_entry_method",
          "value": "in",
          "tag": "door_entry_method",
          "update_time": "0001-01-01T00:00:00Z",
          "create_time": "0001-01-01T00:00:00Z"
        }
      ],
      "support_feature": [
        "capture"
      ],
      "bind_same_paired": false,
      "accessDetectZones": [],
      "isAccessReader": false
    }
  },
  {

    "event": "access.data.device.update",
    "receiver_id": "",
    "event_object_id": "00000000000000000000000c",
    "save_to_history": false,
    "data": {

      "unique_id": "00000000000000000000000c",
      "name": "Test Name 65",
      "alias": "",
      "device_type": "UVC G6 Pro Entry",
      "connected_uah_id": "",
      "location_id": "",
      "firmware": "5.3.95",
      "version": "5.3.95",
      "ip": "192.0.2.13",
      "mac": "aa:bb:cc:00:00:10",
      "hw_type": "",
      "start_time": 1782282073,
      "last_seen": null,
      "security_check": null,
      "source": null,
      "bom_rev": null,
      "guid": "00000000-0000-0000-0000-000000000034",
      "need_advisory": null,
      "is_camera": true,
      "resource_name": "",
      "revision": null,
      "revision_update_time": null,
      "version_update_time": null,
      "firmware_update_time": null,
      "adopt_time": null,
      "location": null,
      "configs": [
        {

          "device_id": "00000000000000000000000c",
          "key": "capture_enable",
          "value": "yes",
          "tag": "device_extra",
          "update_time": "0001-01-01T00:00:00Z",
          "create_time": "0001-01-01T00:00:00Z"
        },
        {

          "device_id": "00000000000000000000000c",
          "key": "capture",
          "value": "yes",
          "tag": "device_extra",
          "update_time": "0001-01-01T00:00:00Z",
          "create_time": "0001-01-01T00:00:00Z"
        },
        {

          "device_id": "00000000000000000000000c",
          "key": "door_entry_method",
          "value": "in",
          "tag": "door_entry_method",
          "update_time": "0001-01-01T00:00:00Z",
          "create_time": "0001-01-01T00:00:00Z"
        }
      ],
      "is_connected": true,
      "is_online": true,
      "is_revision_up_to_date": false,
      "is_adopted": true,
      "is_managed": true,
      "is_upgrade_blocked": false,
      "is_export_sf_blocked": false,
      "is_rebooting": false,
      "update": null,
      "capabilities": [
        "support_register_card",
        "nfc_card_easy_provision",
        "support_mobile_unlock",
        "support_apple_pass",
        "show_face_method",
        "support_inhouse_sdk",
        "anti_spoofing_level",
        "support_face_sensitivity",
        "pin_code",
        "qr_code",
        "support_greeting",
        "support_caller_manager",
        "support_directory_direct",
        "support_show_interface_image",
        "support_show_status_bar",
        "support_show_heading",
        "identity_unlock_control_cmd",
        "support_ems",
        "doorbell_timeout",
        "doorbell_bind",
        "identity_support_ems",
        "identity_remote_view",
        "identity_face_unlock",
        "identity_is_camera",
        "support_record_hq_stream",
        "keypad_layout"
      ],
      "template": null,
      "images": {

        "xs": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_25x25.png",
        "s": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_32x32.png",
        "m": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_51x51.png",
        "l": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_64x64.png",
        "xl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_101x101.png",
        "xxl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_128x128.png",
        "animation": [
          "icons/g6-pro-entry-close.png",
          "icons/g6-pro-entry-open.png"
        ]
      },
      "camera_resource": {

        "mac": "AABBCC000010",
        "ip": "192.0.2.13",
        "name": "Test Name 65",
        "status": "online",
        "firmwareStatus": "upToDate",
        "firmware": "5.3.95",
        "startupTime": 1782282073022,
        "model": "G6 Pro Entry",
        "shortname": "Test shortname 66",
        "isManaged": true,
        "isAdopted": true,
        "isConnected": true,
        "metadata": {

          "deviceType": "camera",
          "uniqueId": "00000000000000000000000c"
        },
        "guid": "00000000-0000-0000-0000-000000000034",
        "images": {

          "xs": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_25x25.png",
          "s": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_32x32.png",
          "m": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_51x51.png",
          "l": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_64x64.png",
          "xl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_101x101.png",
          "xxl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_128x128.png",
          "animation": [
            "icons/g6-pro-entry-close.png",
            "icons/g6-pro-entry-open.png"
          ]
        },
        "source": "protect",
        "uniqueId": "00000000000000000000000c",
        "type": "UVC G6 Pro Entry",
        "supportLicensePlate": true,
        "supportDetectLPOnly": true,
        "videoWidth": 3024,
        "videoHeight": 4096,
        "videoCodec": "h265",
        "lastSeen": 1786606685022,
        "hubMac": "",
        "smartDetectZones": [
          {

            "id": 10001,
            "name": "Test Name 17",
            "color": "#AB46BC",
            "points": [
              [
                0,
                0
              ],
              [
                1,
                0
              ],
              [
                1,
                1
              ],
              [
                0,
                1
              ]
            ],
            "sensitivity": 50,
            "objectTypes": [
              "person",
              "vehicle",
              "animal",
              "face",
              "licensePlate"
            ],
            "isTriggerLightEnabled": true,
            "triggerAccessTypes": [],
            "source": "unifi-access",
            "enableAccessLPOnlyMode": false
          }
        ],
        "allSmartDetectZones": [
          {

            "id": 1,
            "name": "Test Name 67",
            "color": "#AB46BC",
            "points": [
              [
                0,
                0
              ],
              [
                1,
                0
              ],
              [
                1,
                1
              ],
              [
                0,
                1
              ]
            ],
            "sensitivity": 50,
            "objectTypes": [
              "person",
              "vehicle",
              "animal",
              "face"
            ],
            "isTriggerLightEnabled": true,
            "triggerAccessTypes": [],
            "source": "unifi-protect",
            "enableAccessLPOnlyMode": false
          }
        ],
        "smartDetectSettings": {

          "objectTypes": [
            "person",
            "vehicle",
            "animal",
            "package",
            "face",
            "licensePlate"
          ],
          "autoTrackingObjectTypes": [],
          "autoTrackingWithZoom": true,
          "audioTypes": [
            "alrmSmoke",
            "alrmCmonx",
            "alrmSiren",
            "alrmBabyCry",
            "alrmSpeak",
            "alrmBurglar",
            "alrmCarHorn",
            "alrmBark",
            "alrmGlassBreak"
          ],
          "enableTamperDetection": false,
          "detectionRange": {

            "max": 0,
            "min": 0
          }
        },
        "supportDoorAccessConfig": true,
        "recordingSettings": {

          "mode": "always",
          "prePaddingSecs": 2,
          "postPaddingSecs": 2,
          "smartDetectPrePaddingSecs": 2,
          "smartDetectPostPaddingSecs": 2,
          "minMotionEventTrigger": 1000,
          "endMotionEventDelay": 3000,
          "suppressIlluminationSurge": false,
          "inScheduleMode": "always",
          "outScheduleMode": "never",
          "geofencing": "off",
          "motionAlgorithm": "enhanced",
          "enableMotionDetection": false,
          "createAccessEvent": true,
          "useNewMotionAlgorithm": true
        },
        "osdSettings": {

          "isNameEnabled": false,
          "isDateEnabled": true,
          "isLogoEnabled": false,
          "isDebugEnabled": false
        },
        "micVolume": 100,
        "isMicEnabled": true,
        "talkbackSettings": {

          "bindAddr": "192.0.2.14",
          "bindPort": 7004,
          "bitsPerSample": 16,
          "channels": 1,
          "filterAddr": "",
          "filterPort": 0,
          "quality": 100,
          "samplingRate": 22050,
          "typeFmt": "aac",
          "typeIn": "serverudp"
        },
        "hasSpeaker": true,
        "isWaterproofCaseAttached": false,
        "ispSettings": {

          "aeMode": "auto",
          "irLedMode": "auto",
          "irLedLevel": 255,
          "wdr": 1,
          "icrSensitivity": 0,
          "icrSwitchMode": "sensitivity",
          "icrCustomValue": 1,
          "brightness": 50,
          "contrast": 50,
          "hue": 50,
          "saturation": 50,
          "sharpness": 50,
          "denoise": 50,
          "isColorNightVisionEnabled": true,
          "spotlightDuration": 15,
          "isFlippedVertical": false,
          "isFlippedHorizontal": false,
          "isAutoRotateEnabled": false,
          "isLdcEnabled": true,
          "is3dnrEnabled": true,
          "isExternalIrEnabled": false,
          "isAggressiveAntiFlickerEnabled": false,
          "isPauseMotionEnabled": false,
          "dZoomCenterX": 50,
          "dZoomCenterY": 50,
          "dZoomScale": 0,
          "dZoomStreamId": 4,
          "focusPosition": 0,
          "touchFocusX": 1001,
          "touchFocusY": 1001,
          "zoomPosition": 0,
          "mountPosition": "ceiling",
          "hdrMode": "normal",
          "sceneMode": "auto",
          "isSmokeCoverModeEnabled": false
        },
        "isPoorNetwork": false,
        "featureFlags": {

          "smartDetectTypes": [
            "person",
            "vehicle",
            "animal",
            "package",
            "face",
            "licensePlate"
          ],
          "supportDoorAccessConfig": true,
          "supportNfc": false,
          "supportLpOnly": false,
          "supportLpDetectionWithoutVehicle": true,
          "hasMic": true,
          "hasPackageCamera": true,
          "hasPackageZoneSupportForSecondaryLens": true,
          "canOpticalZoom": false,
          "hotPlug": {

            "audio": null
          },
          "reader": {

            "supportAccessMethods": [
              "nfc",
              "touchPass",
              "pinCode",
              "btButton",
              "btTap",
              "face",
              "qrCode"
            ],
            "support2fa": false,
            "supportLocate": true,
            "supportDoorDirection": true,
            "supportCallerManager": true,
            "supportInterfaceDirectory": true,
            "supportGreetings": true,
            "supportShowInterfaceImage": true,
            "supportShowStatusBar": true,
            "supportShowHeading": true,
            "supportGateStop": true
          }
        },
        "currentResolution": "5K",
        "supportNfc": true,
        "supportTouchPass": true,
        "supportFaceUnlock": true,
        "supportBtButton": true,
        "supportBtTap": true,
        "supportQrCode": true,
        "supportPIN": true,
        "supportTwoStepAuth": false,
        "supportGreeting": true,
        "supportDirection": false,
        "supportCallerManager": true,
        "supportMobileUnlockV2": true,
        "supportCallerDirectory": true,
        "supportTwilioSip": false,
        "supportGateStop": true,
        "supportShowInterfaceImage": true,
        "supportShowStatusBar": true,
        "supportShowHeading": true,
        "isFloodlightTriggerEnabled": false,
        "stats": {

          "video": {

            "recordingStart": 1784222131742,
            "recordingEnd": 1786606685934,
            "recordingStartLQ": 1784210492601,
            "recordingEndLQ": 1786606685944
          }
        },
        "location": [],
        "configs": [
          {

            "device_id": "00000000000000000000000c",
            "key": "capture_enable",
            "value": "yes",
            "tag": "device_extra",
            "update_time": "0001-01-01T00:00:00Z",
            "create_time": "0001-01-01T00:00:00Z"
          },
          {

            "device_id": "00000000000000000000000c",
            "key": "capture",
            "value": "yes",
            "tag": "device_extra",
            "update_time": "0001-01-01T00:00:00Z",
            "create_time": "0001-01-01T00:00:00Z"
          },
          {

            "device_id": "00000000000000000000000c",
            "key": "door_entry_method",
            "value": "in",
            "tag": "door_entry_method",
            "update_time": "0001-01-01T00:00:00Z",
            "create_time": "0001-01-01T00:00:00Z"
          }
        ],
        "support_feature": [
          "capture"
        ],
        "bind_same_paired": false,
        "accessDetectZones": [],
        "isAccessReader": false
      }
    }
  },
  {

    "event": "access.data.device.delete",
    "receiver_id": "",
    "event_object_id": "00000000000000000000000c",
    "save_to_history": false,
    "data": {

      "unique_id": "00000000000000000000000c",
      "name": "Test Name 65",
      "alias": "",
      "device_type": "UVC G6 Pro Entry",
      "connected_uah_id": "",
      "location_id": "",
      "firmware": "5.3.95",
      "version": "5.3.95",
      "ip": "192.0.2.13",
      "mac": "aa:bb:cc:00:00:10",
      "hw_type": null,
      "start_time": null,
      "last_seen": null,
      "security_check": null,
      "source": null,
      "bom_rev": null,
      "guid": null,
      "need_advisory": null,
      "is_camera": true,
      "resource_name": "",
      "revision": null,
      "revision_update_time": null,
      "version_update_time": null,
      "firmware_update_time": null,
      "adopt_time": null
    }
  },
  {

    "event": "access.data.v2.device.delete",
    "receiver_id": "",
    "event_object_id": "00000000-0000-0000-0000-000000000046",
    "save_to_history": false,
    "data": null,
    "meta": {

      "object_type": "device",
      "target_field": null,
      "all_field": true,
      "id": "00000000000000000000000c",
      "source": ""
    }
  },
  {

    "event": "access.data.v2.device.update",
    "receiver_id": "",
    "event_object_id": "00000000-0000-0000-0000-000000000047",
    "save_to_history": false,
    "data": {

      "name": "Test Name 65",
      "alias": "",
      "id": "00000000000000000000000c",
      "ip": "192.0.2.13",
      "mac": "AABBCC000010",
      "online": true,
      "adopting": false,
      "device_type": "UVC G6 Pro Entry",
      "connected_hub_id": "",
      "location_id": "",
      "firmware": "5.3.95",
      "version": "",
      "guid": "00000000-0000-0000-0000-000000000034",
      "start_time": 1782282073022,
      "hw_type": "",
      "revision": "",
      "cap": [
        "capture",
        "support_register_card"
      ],
      "category": [
        "camera"
      ]
    },
    "meta": {

      "object_type": "device",
      "target_field": null,
      "all_field": true,
      "id": "00000000000000000000000c",
      "source": ""
    }
  },
  {

    "event": "access.data.camera.update",
    "receiver_id": "",
    "event_object_id": "00000000000000000000000c",
    "save_to_history": false,
    "data": {

      "mac": "AABBCC000010",
      "ip": "192.0.2.13",
      "name": "Test Name 65",
      "status": "online",
      "firmwareStatus": "upToDate",
      "firmware": "5.3.95",
      "startupTime": 1782282073024,
      "model": "G6 Pro Entry",
      "shortname": "Test shortname 66",
      "isManaged": true,
      "isAdopted": true,
      "isConnected": true,
      "metadata": {

        "deviceType": "camera",
        "uniqueId": "00000000000000000000000c"
      },
      "guid": "00000000-0000-0000-0000-000000000034",
      "images": {

        "xs": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_25x25.png",
        "s": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_32x32.png",
        "m": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_51x51.png",
        "l": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_64x64.png",
        "xl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_101x101.png",
        "xxl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_128x128.png",
        "animation": [
          "icons/g6-pro-entry-close.png",
          "icons/g6-pro-entry-open.png"
        ]
      },
      "source": "protect",
      "uniqueId": "00000000000000000000000c",
      "type": "UVC G6 Pro Entry",
      "supportLicensePlate": true,
      "supportDetectLPOnly": true,
      "videoWidth": 3024,
      "videoHeight": 4096,
      "videoCodec": "h265",
      "lastSeen": 1786606745024,
      "hubMac": "",
      "smartDetectZones": [
        {

          "id": 10001,
          "name": "Test Name 17",
          "color": "#AB46BC",
          "points": [
            [
              0,
              0
            ],
            [
              1,
              0
            ],
            [
              1,
              1
            ],
            [
              0,
              1
            ]
          ],
          "sensitivity": 50,
          "objectTypes": [
            "person",
            "vehicle",
            "animal",
            "face",
            "licensePlate"
          ],
          "isTriggerLightEnabled": true,
          "triggerAccessTypes": [],
          "source": "unifi-access",
          "enableAccessLPOnlyMode": false
        }
      ],
      "allSmartDetectZones": [
        {

          "id": 1,
          "name": "Test Name 67",
          "color": "#AB46BC",
          "points": [
            [
              0,
              0
            ],
            [
              1,
              0
            ],
            [
              1,
              1
            ],
            [
              0,
              1
            ]
          ],
          "sensitivity": 50,
          "objectTypes": [
            "person",
            "vehicle",
            "animal",
            "face"
          ],
          "isTriggerLightEnabled": true,
          "triggerAccessTypes": [],
          "source": "unifi-protect",
          "enableAccessLPOnlyMode": false
        }
      ],
      "smartDetectSettings": {

        "objectTypes": [
          "person",
          "vehicle",
          "animal",
          "package",
          "face",
          "licensePlate"
        ],
        "autoTrackingObjectTypes": [],
        "autoTrackingWithZoom": true,
        "audioTypes": [
          "alrmSmoke",
          "alrmCmonx",
          "alrmSiren",
          "alrmBabyCry",
          "alrmSpeak",
          "alrmBurglar",
          "alrmCarHorn",
          "alrmBark",
          "alrmGlassBreak"
        ],
        "enableTamperDetection": false,
        "detectionRange": {

          "max": 0,
          "min": 0
        }
      },
      "supportDoorAccessConfig": true,
      "recordingSettings": {

        "mode": "always",
        "prePaddingSecs": 2,
        "postPaddingSecs": 2,
        "smartDetectPrePaddingSecs": 2,
        "smartDetectPostPaddingSecs": 2,
        "minMotionEventTrigger": 1000,
        "endMotionEventDelay": 3000,
        "suppressIlluminationSurge": false,
        "inScheduleMode": "always",
        "outScheduleMode": "never",
        "geofencing": "off",
        "motionAlgorithm": "enhanced",
        "enableMotionDetection": false,
        "createAccessEvent": true,
        "useNewMotionAlgorithm": true
      },
      "osdSettings": {

        "isNameEnabled": false,
        "isDateEnabled": true,
        "isLogoEnabled": false,
        "isDebugEnabled": false
      },
      "micVolume": 100,
      "isMicEnabled": true,
      "talkbackSettings": {

        "bindAddr": "192.0.2.14",
        "bindPort": 7004,
        "bitsPerSample": 16,
        "channels": 1,
        "filterAddr": "",
        "filterPort": 0,
        "quality": 100,
        "samplingRate": 22050,
        "typeFmt": "aac",
        "typeIn": "serverudp"
      },
      "hasSpeaker": true,
      "isWaterproofCaseAttached": false,
      "ispSettings": {

        "aeMode": "auto",
        "irLedMode": "auto",
        "irLedLevel": 255,
        "wdr": 1,
        "icrSensitivity": 0,
        "icrSwitchMode": "sensitivity",
        "icrCustomValue": 1,
        "brightness": 50,
        "contrast": 50,
        "hue": 50,
        "saturation": 50,
        "sharpness": 50,
        "denoise": 50,
        "isColorNightVisionEnabled": true,
        "spotlightDuration": 15,
        "isFlippedVertical": false,
        "isFlippedHorizontal": false,
        "isAutoRotateEnabled": false,
        "isLdcEnabled": true,
        "is3dnrEnabled": true,
        "isExternalIrEnabled": false,
        "isAggressiveAntiFlickerEnabled": false,
        "isPauseMotionEnabled": false,
        "dZoomCenterX": 50,
        "dZoomCenterY": 50,
        "dZoomScale": 0,
        "dZoomStreamId": 4,
        "focusPosition": 0,
        "touchFocusX": 1001,
        "touchFocusY": 1001,
        "zoomPosition": 0,
        "mountPosition": "ceiling",
        "hdrMode": "normal",
        "sceneMode": "auto",
        "isSmokeCoverModeEnabled": false
      },
      "isPoorNetwork": false,
      "featureFlags": {

        "smartDetectTypes": [
          "person",
          "vehicle",
          "animal",
          "package",
          "face",
          "licensePlate"
        ],
        "supportDoorAccessConfig": true,
        "supportNfc": false,
        "supportLpOnly": false,
        "supportLpDetectionWithoutVehicle": true,
        "hasMic": true,
        "hasPackageCamera": true,
        "hasPackageZoneSupportForSecondaryLens": true,
        "canOpticalZoom": false,
        "hotPlug": {

          "audio": null
        },
        "reader": {

          "supportAccessMethods": [
            "nfc",
            "touchPass",
            "pinCode",
            "btButton",
            "btTap",
            "face",
            "qrCode"
          ],
          "support2fa": false,
          "supportLocate": true,
          "supportDoorDirection": true,
          "supportCallerManager": true,
          "supportInterfaceDirectory": true,
          "supportGreetings": true,
          "supportShowInterfaceImage": true,
          "supportShowStatusBar": true,
          "supportShowHeading": true,
          "supportGateStop": true
        }
      },
      "currentResolution": "5K",
      "supportNfc": true,
      "supportTouchPass": true,
      "supportFaceUnlock": true,
      "supportBtButton": true,
      "supportBtTap": true,
      "supportQrCode": true,
      "supportPIN": true,
      "supportTwoStepAuth": false,
      "supportGreeting": true,
      "supportDirection": false,
      "supportCallerManager": true,
      "supportMobileUnlockV2": true,
      "supportCallerDirectory": true,
      "supportTwilioSip": false,
      "supportGateStop": true,
      "supportShowInterfaceImage": true,
      "supportShowStatusBar": true,
      "supportShowHeading": true,
      "isFloodlightTriggerEnabled": false,
      "stats": {

        "video": {

          "recordingStart": 1784222131742,
          "recordingEnd": 1786606735748,
          "recordingStartLQ": 1784210492601,
          "recordingEndLQ": 1786606735704
        }
      },
      "location": [],
      "configs": [
        {

          "device_id": "00000000000000000000000c",
          "key": "capture_enable",
          "value": "yes",
          "tag": "device_extra",
          "update_time": "0001-01-01T00:00:00Z",
          "create_time": "0001-01-01T00:00:00Z"
        },
        {

          "device_id": "00000000000000000000000c",
          "key": "capture",
          "value": "yes",
          "tag": "device_extra",
          "update_time": "0001-01-01T00:00:00Z",
          "create_time": "0001-01-01T00:00:00Z"
        },
        {

          "device_id": "00000000000000000000000c",
          "key": "door_entry_method",
          "value": "in",
          "tag": "door_entry_method",
          "update_time": "0001-01-01T00:00:00Z",
          "create_time": "0001-01-01T00:00:00Z"
        }
      ],
      "support_feature": [
        "capture"
      ],
      "bind_same_paired": false,
      "accessDetectZones": [],
      "isAccessReader": false
    }
  },
  {

    "event": "access.data.device.update",
    "receiver_id": "",
    "event_object_id": "00000000000000000000000c",
    "save_to_history": false,
    "data": {

      "unique_id": "00000000000000000000000c",
      "name": "Test Name 65",
      "alias": "",
      "device_type": "UVC G6 Pro Entry",
      "connected_uah_id": "",
      "location_id": "",
      "firmware": "5.3.95",
      "version": "5.3.95",
      "ip": "192.0.2.13",
      "mac": "aa:bb:cc:00:00:10",
      "hw_type": "",
      "start_time": 1782282073,
      "last_seen": null,
      "security_check": null,
      "source": null,
      "bom_rev": null,
      "guid": "00000000-0000-0000-0000-000000000034",
      "need_advisory": null,
      "is_camera": true,
      "resource_name": "",
      "revision": null,
      "revision_update_time": null,
      "version_update_time": null,
      "firmware_update_time": null,
      "adopt_time": null,
      "location": null,
      "configs": [
        {

          "device_id": "00000000000000000000000c",
          "key": "capture_enable",
          "value": "yes",
          "tag": "device_extra",
          "update_time": "0001-01-01T00:00:00Z",
          "create_time": "0001-01-01T00:00:00Z"
        },
        {

          "device_id": "00000000000000000000000c",
          "key": "capture",
          "value": "yes",
          "tag": "device_extra",
          "update_time": "0001-01-01T00:00:00Z",
          "create_time": "0001-01-01T00:00:00Z"
        },
        {

          "device_id": "00000000000000000000000c",
          "key": "door_entry_method",
          "value": "in",
          "tag": "door_entry_method",
          "update_time": "0001-01-01T00:00:00Z",
          "create_time": "0001-01-01T00:00:00Z"
        }
      ],
      "is_connected": true,
      "is_online": true,
      "is_revision_up_to_date": false,
      "is_adopted": true,
      "is_managed": true,
      "is_upgrade_blocked": false,
      "is_export_sf_blocked": false,
      "is_rebooting": false,
      "update": null,
      "capabilities": [
        "support_register_card",
        "nfc_card_easy_provision",
        "support_mobile_unlock",
        "support_apple_pass",
        "show_face_method",
        "support_inhouse_sdk",
        "anti_spoofing_level",
        "support_face_sensitivity",
        "pin_code",
        "qr_code",
        "support_greeting",
        "support_caller_manager",
        "support_directory_direct",
        "support_show_interface_image",
        "support_show_status_bar",
        "support_show_heading",
        "identity_unlock_control_cmd",
        "support_ems",
        "doorbell_timeout",
        "doorbell_bind",
        "identity_support_ems",
        "identity_remote_view",
        "identity_face_unlock",
        "identity_is_camera",
        "support_record_hq_stream",
        "keypad_layout"
      ],
      "template": null,
      "images": {

        "xs": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_25x25.png",
        "s": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_32x32.png",
        "m": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_51x51.png",
        "l": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_64x64.png",
        "xl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_101x101.png",
        "xxl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_128x128.png",
        "animation": [
          "icons/g6-pro-entry-close.png",
          "icons/g6-pro-entry-open.png"
        ]
      },
      "camera_resource": {

        "mac": "AABBCC000010",
        "ip": "192.0.2.13",
        "name": "Test Name 65",
        "status": "online",
        "firmwareStatus": "upToDate",
        "firmware": "5.3.95",
        "startupTime": 1782282073024,
        "model": "G6 Pro Entry",
        "shortname": "Test shortname 66",
        "isManaged": true,
        "isAdopted": true,
        "isConnected": true,
        "metadata": {

          "deviceType": "camera",
          "uniqueId": "00000000000000000000000c"
        },
        "guid": "00000000-0000-0000-0000-000000000034",
        "images": {

          "xs": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_25x25.png",
          "s": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_32x32.png",
          "m": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_51x51.png",
          "l": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_64x64.png",
          "xl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_101x101.png",
          "xxl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_128x128.png",
          "animation": [
            "icons/g6-pro-entry-close.png",
            "icons/g6-pro-entry-open.png"
          ]
        },
        "source": "protect",
        "uniqueId": "00000000000000000000000c",
        "type": "UVC G6 Pro Entry",
        "supportLicensePlate": true,
        "supportDetectLPOnly": true,
        "videoWidth": 3024,
        "videoHeight": 4096,
        "videoCodec": "h265",
        "lastSeen": 1786606745024,
        "hubMac": "",
        "smartDetectZones": [
          {

            "id": 10001,
            "name": "Test Name 17",
            "color": "#AB46BC",
            "points": [
              [
                0,
                0
              ],
              [
                1,
                0
              ],
              [
                1,
                1
              ],
              [
                0,
                1
              ]
            ],
            "sensitivity": 50,
            "objectTypes": [
              "person",
              "vehicle",
              "animal",
              "face",
              "licensePlate"
            ],
            "isTriggerLightEnabled": true,
            "triggerAccessTypes": [],
            "source": "unifi-access",
            "enableAccessLPOnlyMode": false
          }
        ],
        "allSmartDetectZones": [
          {

            "id": 1,
            "name": "Test Name 67",
            "color": "#AB46BC",
            "points": [
              [
                0,
                0
              ],
              [
                1,
                0
              ],
              [
                1,
                1
              ],
              [
                0,
                1
              ]
            ],
            "sensitivity": 50,
            "objectTypes": [
              "person",
              "vehicle",
              "animal",
              "face"
            ],
            "isTriggerLightEnabled": true,
            "triggerAccessTypes": [],
            "source": "unifi-protect",
            "enableAccessLPOnlyMode": false
          }
        ],
        "smartDetectSettings": {

          "objectTypes": [
            "person",
            "vehicle",
            "animal",
            "package",
            "face",
            "licensePlate"
          ],
          "autoTrackingObjectTypes": [],
          "autoTrackingWithZoom": true,
          "audioTypes": [
            "alrmSmoke",
            "alrmCmonx",
            "alrmSiren",
            "alrmBabyCry",
            "alrmSpeak",
            "alrmBurglar",
            "alrmCarHorn",
            "alrmBark",
            "alrmGlassBreak"
          ],
          "enableTamperDetection": false,
          "detectionRange": {

            "max": 0,
            "min": 0
          }
        },
        "supportDoorAccessConfig": true,
        "recordingSettings": {

          "mode": "always",
          "prePaddingSecs": 2,
          "postPaddingSecs": 2,
          "smartDetectPrePaddingSecs": 2,
          "smartDetectPostPaddingSecs": 2,
          "minMotionEventTrigger": 1000,
          "endMotionEventDelay": 3000,
          "suppressIlluminationSurge": false,
          "inScheduleMode": "always",
          "outScheduleMode": "never",
          "geofencing": "off",
          "motionAlgorithm": "enhanced",
          "enableMotionDetection": false,
          "createAccessEvent": true,
          "useNewMotionAlgorithm": true
        },
        "osdSettings": {

          "isNameEnabled": false,
          "isDateEnabled": true,
          "isLogoEnabled": false,
          "isDebugEnabled": false
        },
        "micVolume": 100,
        "isMicEnabled": true,
        "talkbackSettings": {

          "bindAddr": "192.0.2.14",
          "bindPort": 7004,
          "bitsPerSample": 16,
          "channels": 1,
          "filterAddr": "",
          "filterPort": 0,
          "quality": 100,
          "samplingRate": 22050,
          "typeFmt": "aac",
          "typeIn": "serverudp"
        },
        "hasSpeaker": true,
        "isWaterproofCaseAttached": false,
        "ispSettings": {

          "aeMode": "auto",
          "irLedMode": "auto",
          "irLedLevel": 255,
          "wdr": 1,
          "icrSensitivity": 0,
          "icrSwitchMode": "sensitivity",
          "icrCustomValue": 1,
          "brightness": 50,
          "contrast": 50,
          "hue": 50,
          "saturation": 50,
          "sharpness": 50,
          "denoise": 50,
          "isColorNightVisionEnabled": true,
          "spotlightDuration": 15,
          "isFlippedVertical": false,
          "isFlippedHorizontal": false,
          "isAutoRotateEnabled": false,
          "isLdcEnabled": true,
          "is3dnrEnabled": true,
          "isExternalIrEnabled": false,
          "isAggressiveAntiFlickerEnabled": false,
          "isPauseMotionEnabled": false,
          "dZoomCenterX": 50,
          "dZoomCenterY": 50,
          "dZoomScale": 0,
          "dZoomStreamId": 4,
          "focusPosition": 0,
          "touchFocusX": 1001,
          "touchFocusY": 1001,
          "zoomPosition": 0,
          "mountPosition": "ceiling",
          "hdrMode": "normal",
          "sceneMode": "auto",
          "isSmokeCoverModeEnabled": false
        },
        "isPoorNetwork": false,
        "featureFlags": {

          "smartDetectTypes": [
            "person",
            "vehicle",
            "animal",
            "package",
            "face",
            "licensePlate"
          ],
          "supportDoorAccessConfig": true,
          "supportNfc": false,
          "supportLpOnly": false,
          "supportLpDetectionWithoutVehicle": true,
          "hasMic": true,
          "hasPackageCamera": true,
          "hasPackageZoneSupportForSecondaryLens": true,
          "canOpticalZoom": false,
          "hotPlug": {

            "audio": null
          },
          "reader": {

            "supportAccessMethods": [
              "nfc",
              "touchPass",
              "pinCode",
              "btButton",
              "btTap",
              "face",
              "qrCode"
            ],
            "support2fa": false,
            "supportLocate": true,
            "supportDoorDirection": true,
            "supportCallerManager": true,
            "supportInterfaceDirectory": true,
            "supportGreetings": true,
            "supportShowInterfaceImage": true,
            "supportShowStatusBar": true,
            "supportShowHeading": true,
            "supportGateStop": true
          }
        },
        "currentResolution": "5K",
        "supportNfc": true,
        "supportTouchPass": true,
        "supportFaceUnlock": true,
        "supportBtButton": true,
        "supportBtTap": true,
        "supportQrCode": true,
        "supportPIN": true,
        "supportTwoStepAuth": false,
        "supportGreeting": true,
        "supportDirection": false,
        "supportCallerManager": true,
        "supportMobileUnlockV2": true,
        "supportCallerDirectory": true,
        "supportTwilioSip": false,
        "supportGateStop": true,
        "supportShowInterfaceImage": true,
        "supportShowStatusBar": true,
        "supportShowHeading": true,
        "isFloodlightTriggerEnabled": false,
        "stats": {

          "video": {

            "recordingStart": 1784222131742,
            "recordingEnd": 1786606735748,
            "recordingStartLQ": 1784210492601,
            "recordingEndLQ": 1786606735704
          }
        },
        "location": [],
        "configs": [
          {

            "device_id": "00000000000000000000000c",
            "key": "capture_enable",
            "value": "yes",
            "tag": "device_extra",
            "update_time": "0001-01-01T00:00:00Z",
            "create_time": "0001-01-01T00:00:00Z"
          },
          {

            "device_id": "00000000000000000000000c",
            "key": "capture",
            "value": "yes",
            "tag": "device_extra",
            "update_time": "0001-01-01T00:00:00Z",
            "create_time": "0001-01-01T00:00:00Z"
          },
          {

            "device_id": "00000000000000000000000c",
            "key": "door_entry_method",
            "value": "in",
            "tag": "door_entry_method",
            "update_time": "0001-01-01T00:00:00Z",
            "create_time": "0001-01-01T00:00:00Z"
          }
        ],
        "support_feature": [
          "capture"
        ],
        "bind_same_paired": false,
        "accessDetectZones": [],
        "isAccessReader": false
      }
    }
  },
  {

    "event": "access.data.v2.device.update",
    "receiver_id": "",
    "event_object_id": "00000000-0000-0000-0000-000000000048",
    "save_to_history": false,
    "data": {

      "name": "Test Name 65",
      "alias": "",
      "id": "00000000000000000000000c",
      "ip": "192.0.2.13",
      "mac": "AABBCC000010",
      "online": true,
      "adopting": false,
      "device_type": "UVC G6 Pro Entry",
      "connected_hub_id": "",
      "location_id": "",
      "firmware": "5.3.95",
      "version": "",
      "guid": "00000000-0000-0000-0000-000000000034",
      "start_time": 1782282073024,
      "hw_type": "",
      "revision": "",
      "cap": [
        "capture",
        "support_register_card"
      ],
      "category": [
        "camera"
      ]
    },
    "meta": {

      "object_type": "device",
      "target_field": null,
      "all_field": true,
      "id": "00000000000000000000000c",
      "source": ""
    }
  },
  {

    "event": "access.data.camera.update",
    "receiver_id": "",
    "event_object_id": "00000000000000000000000c",
    "save_to_history": false,
    "data": {

      "mac": "AABBCC000010",
      "ip": "192.0.2.13",
      "name": "Test Name 65",
      "status": "online",
      "firmwareStatus": "upToDate",
      "firmware": "5.3.95",
      "startupTime": 1782282073024,
      "model": "G6 Pro Entry",
      "shortname": "Test shortname 66",
      "isManaged": true,
      "isAdopted": true,
      "isConnected": true,
      "metadata": {

        "deviceType": "camera",
        "uniqueId": "00000000000000000000000c"
      },
      "guid": "00000000-0000-0000-0000-000000000034",
      "images": {

        "xs": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_25x25.png",
        "s": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_32x32.png",
        "m": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_51x51.png",
        "l": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_64x64.png",
        "xl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_101x101.png",
        "xxl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_128x128.png",
        "animation": [
          "icons/g6-pro-entry-close.png",
          "icons/g6-pro-entry-open.png"
        ]
      },
      "source": "protect",
      "uniqueId": "00000000000000000000000c",
      "type": "UVC G6 Pro Entry",
      "supportLicensePlate": true,
      "supportDetectLPOnly": true,
      "videoWidth": 3024,
      "videoHeight": 4096,
      "videoCodec": "h265",
      "lastSeen": 1786606745024,
      "hubMac": "",
      "smartDetectZones": [
        {

          "id": 10001,
          "name": "Test Name 17",
          "color": "#AB46BC",
          "points": [
            [
              0,
              0
            ],
            [
              1,
              0
            ],
            [
              1,
              1
            ],
            [
              0,
              1
            ]
          ],
          "sensitivity": 50,
          "objectTypes": [
            "person",
            "vehicle",
            "animal",
            "face",
            "licensePlate"
          ],
          "isTriggerLightEnabled": true,
          "triggerAccessTypes": [],
          "source": "unifi-access",
          "enableAccessLPOnlyMode": false
        }
      ],
      "allSmartDetectZones": [
        {

          "id": 1,
          "name": "Test Name 67",
          "color": "#AB46BC",
          "points": [
            [
              0,
              0
            ],
            [
              1,
              0
            ],
            [
              1,
              1
            ],
            [
              0,
              1
            ]
          ],
          "sensitivity": 50,
          "objectTypes": [
            "person",
            "vehicle",
            "animal",
            "face"
          ],
          "isTriggerLightEnabled": true,
          "triggerAccessTypes": [],
          "source": "unifi-protect",
          "enableAccessLPOnlyMode": false
        }
      ],
      "smartDetectSettings": {

        "objectTypes": [
          "person",
          "vehicle",
          "animal",
          "package",
          "face",
          "licensePlate"
        ],
        "autoTrackingObjectTypes": [],
        "autoTrackingWithZoom": true,
        "audioTypes": [
          "alrmSmoke",
          "alrmCmonx",
          "alrmSiren",
          "alrmBabyCry",
          "alrmSpeak",
          "alrmBurglar",
          "alrmCarHorn",
          "alrmBark",
          "alrmGlassBreak"
        ],
        "enableTamperDetection": false,
        "detectionRange": {

          "max": 0,
          "min": 0
        }
      },
      "supportDoorAccessConfig": true,
      "recordingSettings": {

        "mode": "always",
        "prePaddingSecs": 2,
        "postPaddingSecs": 2,
        "smartDetectPrePaddingSecs": 2,
        "smartDetectPostPaddingSecs": 2,
        "minMotionEventTrigger": 1000,
        "endMotionEventDelay": 3000,
        "suppressIlluminationSurge": false,
        "inScheduleMode": "always",
        "outScheduleMode": "never",
        "geofencing": "off",
        "motionAlgorithm": "enhanced",
        "enableMotionDetection": false,
        "createAccessEvent": true,
        "useNewMotionAlgorithm": true
      },
      "osdSettings": {

        "isNameEnabled": false,
        "isDateEnabled": true,
        "isLogoEnabled": false,
        "isDebugEnabled": false
      },
      "micVolume": 100,
      "isMicEnabled": true,
      "talkbackSettings": {

        "bindAddr": "192.0.2.14",
        "bindPort": 7004,
        "bitsPerSample": 16,
        "channels": 1,
        "filterAddr": "",
        "filterPort": 0,
        "quality": 100,
        "samplingRate": 22050,
        "typeFmt": "aac",
        "typeIn": "serverudp"
      },
      "hasSpeaker": true,
      "isWaterproofCaseAttached": false,
      "ispSettings": {

        "aeMode": "auto",
        "irLedMode": "auto",
        "irLedLevel": 255,
        "wdr": 1,
        "icrSensitivity": 0,
        "icrSwitchMode": "sensitivity",
        "icrCustomValue": 1,
        "brightness": 50,
        "contrast": 50,
        "hue": 50,
        "saturation": 50,
        "sharpness": 50,
        "denoise": 50,
        "isColorNightVisionEnabled": true,
        "spotlightDuration": 15,
        "isFlippedVertical": false,
        "isFlippedHorizontal": false,
        "isAutoRotateEnabled": false,
        "isLdcEnabled": true,
        "is3dnrEnabled": true,
        "isExternalIrEnabled": false,
        "isAggressiveAntiFlickerEnabled": false,
        "isPauseMotionEnabled": false,
        "dZoomCenterX": 50,
        "dZoomCenterY": 50,
        "dZoomScale": 0,
        "dZoomStreamId": 4,
        "focusPosition": 0,
        "touchFocusX": 1001,
        "touchFocusY": 1001,
        "zoomPosition": 0,
        "mountPosition": "ceiling",
        "hdrMode": "normal",
        "sceneMode": "auto",
        "isSmokeCoverModeEnabled": false
      },
      "isPoorNetwork": false,
      "featureFlags": {

        "smartDetectTypes": [
          "person",
          "vehicle",
          "animal",
          "package",
          "face",
          "licensePlate"
        ],
        "supportDoorAccessConfig": true,
        "supportNfc": false,
        "supportLpOnly": false,
        "supportLpDetectionWithoutVehicle": true,
        "hasMic": true,
        "hasPackageCamera": true,
        "hasPackageZoneSupportForSecondaryLens": true,
        "canOpticalZoom": false,
        "hotPlug": {

          "audio": null
        },
        "reader": {

          "supportAccessMethods": [
            "nfc",
            "touchPass",
            "pinCode",
            "btButton",
            "btTap",
            "face",
            "qrCode"
          ],
          "support2fa": false,
          "supportLocate": true,
          "supportDoorDirection": true,
          "supportCallerManager": true,
          "supportInterfaceDirectory": true,
          "supportGreetings": true,
          "supportShowInterfaceImage": true,
          "supportShowStatusBar": true,
          "supportShowHeading": true,
          "supportGateStop": true
        }
      },
      "currentResolution": "5K",
      "supportNfc": true,
      "supportTouchPass": true,
      "supportFaceUnlock": true,
      "supportBtButton": true,
      "supportBtTap": true,
      "supportQrCode": true,
      "supportPIN": true,
      "supportTwoStepAuth": false,
      "supportGreeting": true,
      "supportDirection": false,
      "supportCallerManager": true,
      "supportMobileUnlockV2": true,
      "supportCallerDirectory": true,
      "supportTwilioSip": false,
      "supportGateStop": true,
      "supportShowInterfaceImage": true,
      "supportShowStatusBar": true,
      "supportShowHeading": true,
      "isFloodlightTriggerEnabled": false,
      "stats": {

        "video": {

          "recordingStart": 1784222308652,
          "recordingEnd": 1786606784861,
          "recordingStartLQ": 1784222308652,
          "recordingEndLQ": 1786606784878
        }
      },
      "location": [],
      "configs": [
        {

          "device_id": "00000000000000000000000c",
          "key": "capture_enable",
          "value": "yes",
          "tag": "device_extra",
          "update_time": "0001-01-01T00:00:00Z",
          "create_time": "0001-01-01T00:00:00Z"
        },
        {

          "device_id": "00000000000000000000000c",
          "key": "capture",
          "value": "yes",
          "tag": "device_extra",
          "update_time": "0001-01-01T00:00:00Z",
          "create_time": "0001-01-01T00:00:00Z"
        },
        {

          "device_id": "00000000000000000000000c",
          "key": "door_entry_method",
          "value": "in",
          "tag": "door_entry_method",
          "update_time": "0001-01-01T00:00:00Z",
          "create_time": "0001-01-01T00:00:00Z"
        }
      ],
      "support_feature": [
        "capture"
      ],
      "bind_same_paired": false,
      "accessDetectZones": [],
      "isAccessReader": false
    }
  },
  {

    "event": "access.data.device.update",
    "receiver_id": "",
    "event_object_id": "00000000000000000000000c",
    "save_to_history": false,
    "data": {

      "unique_id": "00000000000000000000000c",
      "name": "Test Name 65",
      "alias": "",
      "device_type": "UVC G6 Pro Entry",
      "connected_uah_id": "",
      "location_id": "",
      "firmware": "5.3.95",
      "version": "5.3.95",
      "ip": "192.0.2.13",
      "mac": "aa:bb:cc:00:00:10",
      "hw_type": "",
      "start_time": 1782282073,
      "last_seen": null,
      "security_check": null,
      "source": null,
      "bom_rev": null,
      "guid": "00000000-0000-0000-0000-000000000034",
      "need_advisory": null,
      "is_camera": true,
      "resource_name": "",
      "revision": null,
      "revision_update_time": null,
      "version_update_time": null,
      "firmware_update_time": null,
      "adopt_time": null,
      "location": null,
      "configs": [
        {

          "device_id": "00000000000000000000000c",
          "key": "capture_enable",
          "value": "yes",
          "tag": "device_extra",
          "update_time": "0001-01-01T00:00:00Z",
          "create_time": "0001-01-01T00:00:00Z"
        },
        {

          "device_id": "00000000000000000000000c",
          "key": "capture",
          "value": "yes",
          "tag": "device_extra",
          "update_time": "0001-01-01T00:00:00Z",
          "create_time": "0001-01-01T00:00:00Z"
        },
        {

          "device_id": "00000000000000000000000c",
          "key": "door_entry_method",
          "value": "in",
          "tag": "door_entry_method",
          "update_time": "0001-01-01T00:00:00Z",
          "create_time": "0001-01-01T00:00:00Z"
        }
      ],
      "is_connected": true,
      "is_online": true,
      "is_revision_up_to_date": false,
      "is_adopted": true,
      "is_managed": true,
      "is_upgrade_blocked": false,
      "is_export_sf_blocked": false,
      "is_rebooting": false,
      "update": null,
      "capabilities": [
        "support_register_card",
        "nfc_card_easy_provision",
        "support_mobile_unlock",
        "support_apple_pass",
        "show_face_method",
        "support_inhouse_sdk",
        "anti_spoofing_level",
        "support_face_sensitivity",
        "pin_code",
        "qr_code",
        "support_greeting",
        "support_caller_manager",
        "support_directory_direct",
        "support_show_interface_image",
        "support_show_status_bar",
        "support_show_heading",
        "identity_unlock_control_cmd",
        "support_ems",
        "doorbell_timeout",
        "doorbell_bind",
        "identity_support_ems",
        "identity_remote_view",
        "identity_face_unlock",
        "identity_is_camera",
        "support_record_hq_stream",
        "keypad_layout"
      ],
      "template": null,
      "images": {

        "xs": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_25x25.png",
        "s": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_32x32.png",
        "m": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_51x51.png",
        "l": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_64x64.png",
        "xl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_101x101.png",
        "xxl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_128x128.png",
        "animation": [
          "icons/g6-pro-entry-close.png",
          "icons/g6-pro-entry-open.png"
        ]
      },
      "camera_resource": {

        "mac": "AABBCC000010",
        "ip": "192.0.2.13",
        "name": "Test Name 65",
        "status": "online",
        "firmwareStatus": "upToDate",
        "firmware": "5.3.95",
        "startupTime": 1782282073024,
        "model": "G6 Pro Entry",
        "shortname": "Test shortname 66",
        "isManaged": true,
        "isAdopted": true,
        "isConnected": true,
        "metadata": {

          "deviceType": "camera",
          "uniqueId": "00000000000000000000000c"
        },
        "guid": "00000000-0000-0000-0000-000000000034",
        "images": {

          "xs": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_25x25.png",
          "s": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_32x32.png",
          "m": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_51x51.png",
          "l": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_64x64.png",
          "xl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_101x101.png",
          "xxl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_128x128.png",
          "animation": [
            "icons/g6-pro-entry-close.png",
            "icons/g6-pro-entry-open.png"
          ]
        },
        "source": "protect",
        "uniqueId": "00000000000000000000000c",
        "type": "UVC G6 Pro Entry",
        "supportLicensePlate": true,
        "supportDetectLPOnly": true,
        "videoWidth": 3024,
        "videoHeight": 4096,
        "videoCodec": "h265",
        "lastSeen": 1786606745024,
        "hubMac": "",
        "smartDetectZones": [
          {

            "id": 10001,
            "name": "Test Name 17",
            "color": "#AB46BC",
            "points": [
              [
                0,
                0
              ],
              [
                1,
                0
              ],
              [
                1,
                1
              ],
              [
                0,
                1
              ]
            ],
            "sensitivity": 50,
            "objectTypes": [
              "person",
              "vehicle",
              "animal",
              "face",
              "licensePlate"
            ],
            "isTriggerLightEnabled": true,
            "triggerAccessTypes": [],
            "source": "unifi-access",
            "enableAccessLPOnlyMode": false
          }
        ],
        "allSmartDetectZones": [
          {

            "id": 1,
            "name": "Test Name 67",
            "color": "#AB46BC",
            "points": [
              [
                0,
                0
              ],
              [
                1,
                0
              ],
              [
                1,
                1
              ],
              [
                0,
                1
              ]
            ],
            "sensitivity": 50,
            "objectTypes": [
              "person",
              "vehicle",
              "animal",
              "face"
            ],
            "isTriggerLightEnabled": true,
            "triggerAccessTypes": [],
            "source": "unifi-protect",
            "enableAccessLPOnlyMode": false
          }
        ],
        "smartDetectSettings": {

          "objectTypes": [
            "person",
            "vehicle",
            "animal",
            "package",
            "face",
            "licensePlate"
          ],
          "autoTrackingObjectTypes": [],
          "autoTrackingWithZoom": true,
          "audioTypes": [
            "alrmSmoke",
            "alrmCmonx",
            "alrmSiren",
            "alrmBabyCry",
            "alrmSpeak",
            "alrmBurglar",
            "alrmCarHorn",
            "alrmBark",
            "alrmGlassBreak"
          ],
          "enableTamperDetection": false,
          "detectionRange": {

            "max": 0,
            "min": 0
          }
        },
        "supportDoorAccessConfig": true,
        "recordingSettings": {

          "mode": "always",
          "prePaddingSecs": 2,
          "postPaddingSecs": 2,
          "smartDetectPrePaddingSecs": 2,
          "smartDetectPostPaddingSecs": 2,
          "minMotionEventTrigger": 1000,
          "endMotionEventDelay": 3000,
          "suppressIlluminationSurge": false,
          "inScheduleMode": "always",
          "outScheduleMode": "never",
          "geofencing": "off",
          "motionAlgorithm": "enhanced",
          "enableMotionDetection": false,
          "createAccessEvent": true,
          "useNewMotionAlgorithm": true
        },
        "osdSettings": {

          "isNameEnabled": false,
          "isDateEnabled": true,
          "isLogoEnabled": false,
          "isDebugEnabled": false
        },
        "micVolume": 100,
        "isMicEnabled": true,
        "talkbackSettings": {

          "bindAddr": "192.0.2.14",
          "bindPort": 7004,
          "bitsPerSample": 16,
          "channels": 1,
          "filterAddr": "",
          "filterPort": 0,
          "quality": 100,
          "samplingRate": 22050,
          "typeFmt": "aac",
          "typeIn": "serverudp"
        },
        "hasSpeaker": true,
        "isWaterproofCaseAttached": false,
        "ispSettings": {

          "aeMode": "auto",
          "irLedMode": "auto",
          "irLedLevel": 255,
          "wdr": 1,
          "icrSensitivity": 0,
          "icrSwitchMode": "sensitivity",
          "icrCustomValue": 1,
          "brightness": 50,
          "contrast": 50,
          "hue": 50,
          "saturation": 50,
          "sharpness": 50,
          "denoise": 50,
          "isColorNightVisionEnabled": true,
          "spotlightDuration": 15,
          "isFlippedVertical": false,
          "isFlippedHorizontal": false,
          "isAutoRotateEnabled": false,
          "isLdcEnabled": true,
          "is3dnrEnabled": true,
          "isExternalIrEnabled": false,
          "isAggressiveAntiFlickerEnabled": false,
          "isPauseMotionEnabled": false,
          "dZoomCenterX": 50,
          "dZoomCenterY": 50,
          "dZoomScale": 0,
          "dZoomStreamId": 4,
          "focusPosition": 0,
          "touchFocusX": 1001,
          "touchFocusY": 1001,
          "zoomPosition": 0,
          "mountPosition": "ceiling",
          "hdrMode": "normal",
          "sceneMode": "auto",
          "isSmokeCoverModeEnabled": false
        },
        "isPoorNetwork": false,
        "featureFlags": {

          "smartDetectTypes": [
            "person",
            "vehicle",
            "animal",
            "package",
            "face",
            "licensePlate"
          ],
          "supportDoorAccessConfig": true,
          "supportNfc": false,
          "supportLpOnly": false,
          "supportLpDetectionWithoutVehicle": true,
          "hasMic": true,
          "hasPackageCamera": true,
          "hasPackageZoneSupportForSecondaryLens": true,
          "canOpticalZoom": false,
          "hotPlug": {

            "audio": null
          },
          "reader": {

            "supportAccessMethods": [
              "nfc",
              "touchPass",
              "pinCode",
              "btButton",
              "btTap",
              "face",
              "qrCode"
            ],
            "support2fa": false,
            "supportLocate": true,
            "supportDoorDirection": true,
            "supportCallerManager": true,
            "supportInterfaceDirectory": true,
            "supportGreetings": true,
            "supportShowInterfaceImage": true,
            "supportShowStatusBar": true,
            "supportShowHeading": true,
            "supportGateStop": true
          }
        },
        "currentResolution": "5K",
        "supportNfc": true,
        "supportTouchPass": true,
        "supportFaceUnlock": true,
        "supportBtButton": true,
        "supportBtTap": true,
        "supportQrCode": true,
        "supportPIN": true,
        "supportTwoStepAuth": false,
        "supportGreeting": true,
        "supportDirection": false,
        "supportCallerManager": true,
        "supportMobileUnlockV2": true,
        "supportCallerDirectory": true,
        "supportTwilioSip": false,
        "supportGateStop": true,
        "supportShowInterfaceImage": true,
        "supportShowStatusBar": true,
        "supportShowHeading": true,
        "isFloodlightTriggerEnabled": false,
        "stats": {

          "video": {

            "recordingStart": 1784222308652,
            "recordingEnd": 1786606784861,
            "recordingStartLQ": 1784222308652,
            "recordingEndLQ": 1786606784878
          }
        },
        "location": [],
        "configs": [
          {

            "device_id": "00000000000000000000000c",
            "key": "capture_enable",
            "value": "yes",
            "tag": "device_extra",
            "update_time": "0001-01-01T00:00:00Z",
            "create_time": "0001-01-01T00:00:00Z"
          },
          {

            "device_id": "00000000000000000000000c",
            "key": "capture",
            "value": "yes",
            "tag": "device_extra",
            "update_time": "0001-01-01T00:00:00Z",
            "create_time": "0001-01-01T00:00:00Z"
          },
          {

            "device_id": "00000000000000000000000c",
            "key": "door_entry_method",
            "value": "in",
            "tag": "door_entry_method",
            "update_time": "0001-01-01T00:00:00Z",
            "create_time": "0001-01-01T00:00:00Z"
          }
        ],
        "support_feature": [
          "capture"
        ],
        "bind_same_paired": false,
        "accessDetectZones": [],
        "isAccessReader": false
      }
    }
  },
  {

    "event": "access.data.v2.device.update",
    "receiver_id": "",
    "event_object_id": "00000000-0000-0000-0000-000000000049",
    "save_to_history": false,
    "data": {

      "name": "Test Name 65",
      "alias": "",
      "id": "00000000000000000000000c",
      "ip": "192.0.2.13",
      "mac": "AABBCC000010",
      "online": true,
      "adopting": false,
      "device_type": "UVC G6 Pro Entry",
      "connected_hub_id": "",
      "location_id": "",
      "firmware": "5.3.95",
      "version": "",
      "guid": "00000000-0000-0000-0000-000000000034",
      "start_time": 1782282073024,
      "hw_type": "",
      "revision": "",
      "cap": [
        "capture",
        "support_register_card"
      ],
      "category": [
        "camera"
      ]
    },
    "meta": {

      "object_type": "device",
      "target_field": null,
      "all_field": true,
      "id": "00000000000000000000000c",
      "source": ""
    }
  },
  {

    "event": "access.data.device.delete",
    "receiver_id": "",
    "event_object_id": "00000000000000000000000c",
    "save_to_history": false,
    "data": {

      "unique_id": "00000000000000000000000c",
      "name": "Test Name 65",
      "alias": "",
      "device_type": "UVC G6 Pro Entry",
      "connected_uah_id": "",
      "location_id": "",
      "firmware": "5.3.95",
      "version": "5.3.95",
      "ip": "192.0.2.13",
      "mac": "aa:bb:cc:00:00:10",
      "hw_type": null,
      "start_time": null,
      "last_seen": null,
      "security_check": null,
      "source": null,
      "bom_rev": null,
      "guid": null,
      "need_advisory": null,
      "is_camera": true,
      "resource_name": "",
      "revision": null,
      "revision_update_time": null,
      "version_update_time": null,
      "firmware_update_time": null,
      "adopt_time": null
    }
  },
  {

    "event": "access.data.v2.device.delete",
    "receiver_id": "",
    "event_object_id": "00000000-0000-0000-0000-00000000004a",
    "save_to_history": false,
    "data": null,
    "meta": {

      "object_type": "device",
      "target_field": null,
      "all_field": true,
      "id": "00000000000000000000000c",
      "source": ""
    }
  },
  {

    "event": "access.data.camera.update",
    "receiver_id": "",
    "event_object_id": "00000000000000000000000c",
    "save_to_history": false,
    "data": {

      "mac": "AABBCC000010",
      "ip": "192.0.2.13",
      "name": "Test Name 65",
      "status": "online",
      "firmwareStatus": "upToDate",
      "firmware": "5.3.95",
      "startupTime": 1782282073199,
      "model": "G6 Pro Entry",
      "shortname": "Test shortname 66",
      "isManaged": true,
      "isAdopted": true,
      "isConnected": true,
      "metadata": {

        "deviceType": "camera",
        "uniqueId": "00000000000000000000000c"
      },
      "guid": "00000000-0000-0000-0000-000000000034",
      "images": {

        "xs": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_25x25.png",
        "s": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_32x32.png",
        "m": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_51x51.png",
        "l": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_64x64.png",
        "xl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_101x101.png",
        "xxl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_128x128.png",
        "animation": [
          "icons/g6-pro-entry-close.png",
          "icons/g6-pro-entry-open.png"
        ]
      },
      "source": "protect",
      "uniqueId": "00000000000000000000000c",
      "type": "UVC G6 Pro Entry",
      "supportLicensePlate": true,
      "supportDetectLPOnly": true,
      "videoWidth": 3024,
      "videoHeight": 4096,
      "videoCodec": "h265",
      "lastSeen": 1786606805199,
      "hubMac": "",
      "smartDetectZones": [
        {

          "id": 10001,
          "name": "Test Name 17",
          "color": "#AB46BC",
          "points": [
            [
              0,
              0
            ],
            [
              1,
              0
            ],
            [
              1,
              1
            ],
            [
              0,
              1
            ]
          ],
          "sensitivity": 50,
          "objectTypes": [
            "person",
            "vehicle",
            "animal",
            "face",
            "licensePlate"
          ],
          "isTriggerLightEnabled": true,
          "triggerAccessTypes": [],
          "source": "unifi-access",
          "enableAccessLPOnlyMode": false
        }
      ],
      "allSmartDetectZones": [
        {

          "id": 1,
          "name": "Test Name 67",
          "color": "#AB46BC",
          "points": [
            [
              0,
              0
            ],
            [
              1,
              0
            ],
            [
              1,
              1
            ],
            [
              0,
              1
            ]
          ],
          "sensitivity": 50,
          "objectTypes": [
            "person",
            "vehicle",
            "animal",
            "face"
          ],
          "isTriggerLightEnabled": true,
          "triggerAccessTypes": [],
          "source": "unifi-protect",
          "enableAccessLPOnlyMode": false
        }
      ],
      "smartDetectSettings": {

        "objectTypes": [
          "person",
          "vehicle",
          "animal",
          "package",
          "face",
          "licensePlate"
        ],
        "autoTrackingObjectTypes": [],
        "autoTrackingWithZoom": true,
        "audioTypes": [
          "alrmSmoke",
          "alrmCmonx",
          "alrmSiren",
          "alrmBabyCry",
          "alrmSpeak",
          "alrmBurglar",
          "alrmCarHorn",
          "alrmBark",
          "alrmGlassBreak"
        ],
        "enableTamperDetection": false,
        "detectionRange": {

          "max": 0,
          "min": 0
        }
      },
      "supportDoorAccessConfig": true,
      "recordingSettings": {

        "mode": "always",
        "prePaddingSecs": 2,
        "postPaddingSecs": 2,
        "smartDetectPrePaddingSecs": 2,
        "smartDetectPostPaddingSecs": 2,
        "minMotionEventTrigger": 1000,
        "endMotionEventDelay": 3000,
        "suppressIlluminationSurge": false,
        "inScheduleMode": "always",
        "outScheduleMode": "never",
        "geofencing": "off",
        "motionAlgorithm": "enhanced",
        "enableMotionDetection": false,
        "createAccessEvent": true,
        "useNewMotionAlgorithm": true
      },
      "osdSettings": {

        "isNameEnabled": false,
        "isDateEnabled": true,
        "isLogoEnabled": false,
        "isDebugEnabled": false
      },
      "micVolume": 100,
      "isMicEnabled": true,
      "talkbackSettings": {

        "bindAddr": "192.0.2.14",
        "bindPort": 7004,
        "bitsPerSample": 16,
        "channels": 1,
        "filterAddr": "",
        "filterPort": 0,
        "quality": 100,
        "samplingRate": 22050,
        "typeFmt": "aac",
        "typeIn": "serverudp"
      },
      "hasSpeaker": true,
      "isWaterproofCaseAttached": false,
      "ispSettings": {

        "aeMode": "auto",
        "irLedMode": "auto",
        "irLedLevel": 255,
        "wdr": 1,
        "icrSensitivity": 0,
        "icrSwitchMode": "sensitivity",
        "icrCustomValue": 1,
        "brightness": 50,
        "contrast": 50,
        "hue": 50,
        "saturation": 50,
        "sharpness": 50,
        "denoise": 50,
        "isColorNightVisionEnabled": true,
        "spotlightDuration": 15,
        "isFlippedVertical": false,
        "isFlippedHorizontal": false,
        "isAutoRotateEnabled": false,
        "isLdcEnabled": true,
        "is3dnrEnabled": true,
        "isExternalIrEnabled": false,
        "isAggressiveAntiFlickerEnabled": false,
        "isPauseMotionEnabled": false,
        "dZoomCenterX": 50,
        "dZoomCenterY": 50,
        "dZoomScale": 0,
        "dZoomStreamId": 4,
        "focusPosition": 0,
        "touchFocusX": 1001,
        "touchFocusY": 1001,
        "zoomPosition": 0,
        "mountPosition": "ceiling",
        "hdrMode": "normal",
        "sceneMode": "auto",
        "isSmokeCoverModeEnabled": false
      },
      "isPoorNetwork": false,
      "featureFlags": {

        "smartDetectTypes": [
          "person",
          "vehicle",
          "animal",
          "package",
          "face",
          "licensePlate"
        ],
        "supportDoorAccessConfig": true,
        "supportNfc": false,
        "supportLpOnly": false,
        "supportLpDetectionWithoutVehicle": true,
        "hasMic": true,
        "hasPackageCamera": true,
        "hasPackageZoneSupportForSecondaryLens": true,
        "canOpticalZoom": false,
        "hotPlug": {

          "audio": null
        },
        "reader": {

          "supportAccessMethods": [
            "nfc",
            "touchPass",
            "pinCode",
            "btButton",
            "btTap",
            "face",
            "qrCode"
          ],
          "support2fa": false,
          "supportLocate": true,
          "supportDoorDirection": true,
          "supportCallerManager": true,
          "supportInterfaceDirectory": true,
          "supportGreetings": true,
          "supportShowInterfaceImage": true,
          "supportShowStatusBar": true,
          "supportShowHeading": true,
          "supportGateStop": true
        }
      },
      "currentResolution": "5K",
      "supportNfc": true,
      "supportTouchPass": true,
      "supportFaceUnlock": true,
      "supportBtButton": true,
      "supportBtTap": true,
      "supportQrCode": true,
      "supportPIN": true,
      "supportTwoStepAuth": false,
      "supportGreeting": true,
      "supportDirection": false,
      "supportCallerManager": true,
      "supportMobileUnlockV2": true,
      "supportCallerDirectory": true,
      "supportTwilioSip": false,
      "supportGateStop": true,
      "supportShowInterfaceImage": true,
      "supportShowStatusBar": true,
      "supportShowHeading": true,
      "isFloodlightTriggerEnabled": false,
      "stats": {

        "video": {

          "recordingStart": 1784222308652,
          "recordingEnd": 1786606834521,
          "recordingStartLQ": 1784222308652,
          "recordingEndLQ": 1786606834529
        }
      },
      "location": [],
      "configs": [
        {

          "device_id": "00000000000000000000000c",
          "key": "capture_enable",
          "value": "yes",
          "tag": "device_extra",
          "update_time": "0001-01-01T00:00:00Z",
          "create_time": "0001-01-01T00:00:00Z"
        },
        {

          "device_id": "00000000000000000000000c",
          "key": "capture",
          "value": "yes",
          "tag": "device_extra",
          "update_time": "0001-01-01T00:00:00Z",
          "create_time": "0001-01-01T00:00:00Z"
        },
        {

          "device_id": "00000000000000000000000c",
          "key": "door_entry_method",
          "value": "in",
          "tag": "door_entry_method",
          "update_time": "0001-01-01T00:00:00Z",
          "create_time": "0001-01-01T00:00:00Z"
        }
      ],
      "support_feature": [
        "capture"
      ],
      "bind_same_paired": false,
      "accessDetectZones": [],
      "isAccessReader": false
    }
  },
  {

    "event": "access.data.device.update",
    "receiver_id": "",
    "event_object_id": "00000000000000000000000c",
    "save_to_history": false,
    "data": {

      "unique_id": "00000000000000000000000c",
      "name": "Test Name 65",
      "alias": "",
      "device_type": "UVC G6 Pro Entry",
      "connected_uah_id": "",
      "location_id": "",
      "firmware": "5.3.95",
      "version": "5.3.95",
      "ip": "192.0.2.13",
      "mac": "aa:bb:cc:00:00:10",
      "hw_type": "",
      "start_time": 1782282073,
      "last_seen": null,
      "security_check": null,
      "source": null,
      "bom_rev": null,
      "guid": "00000000-0000-0000-0000-000000000034",
      "need_advisory": null,
      "is_camera": true,
      "resource_name": "",
      "revision": null,
      "revision_update_time": null,
      "version_update_time": null,
      "firmware_update_time": null,
      "adopt_time": null,
      "location": null,
      "configs": [
        {

          "device_id": "00000000000000000000000c",
          "key": "capture_enable",
          "value": "yes",
          "tag": "device_extra",
          "update_time": "0001-01-01T00:00:00Z",
          "create_time": "0001-01-01T00:00:00Z"
        },
        {

          "device_id": "00000000000000000000000c",
          "key": "capture",
          "value": "yes",
          "tag": "device_extra",
          "update_time": "0001-01-01T00:00:00Z",
          "create_time": "0001-01-01T00:00:00Z"
        },
        {

          "device_id": "00000000000000000000000c",
          "key": "door_entry_method",
          "value": "in",
          "tag": "door_entry_method",
          "update_time": "0001-01-01T00:00:00Z",
          "create_time": "0001-01-01T00:00:00Z"
        }
      ],
      "is_connected": true,
      "is_online": true,
      "is_revision_up_to_date": false,
      "is_adopted": true,
      "is_managed": true,
      "is_upgrade_blocked": false,
      "is_export_sf_blocked": false,
      "is_rebooting": false,
      "update": null,
      "capabilities": [
        "support_register_card",
        "nfc_card_easy_provision",
        "support_mobile_unlock",
        "support_apple_pass",
        "show_face_method",
        "support_inhouse_sdk",
        "anti_spoofing_level",
        "support_face_sensitivity",
        "pin_code",
        "qr_code",
        "support_greeting",
        "support_caller_manager",
        "support_directory_direct",
        "support_show_interface_image",
        "support_show_status_bar",
        "support_show_heading",
        "identity_unlock_control_cmd",
        "support_ems",
        "doorbell_timeout",
        "doorbell_bind",
        "identity_support_ems",
        "identity_remote_view",
        "identity_face_unlock",
        "identity_is_camera",
        "support_record_hq_stream",
        "keypad_layout"
      ],
      "template": null,
      "images": {

        "xs": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_25x25.png",
        "s": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_32x32.png",
        "m": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_51x51.png",
        "l": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_64x64.png",
        "xl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_101x101.png",
        "xxl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_128x128.png",
        "animation": [
          "icons/g6-pro-entry-close.png",
          "icons/g6-pro-entry-open.png"
        ]
      },
      "camera_resource": {

        "mac": "AABBCC000010",
        "ip": "192.0.2.13",
        "name": "Test Name 65",
        "status": "online",
        "firmwareStatus": "upToDate",
        "firmware": "5.3.95",
        "startupTime": 1782282073199,
        "model": "G6 Pro Entry",
        "shortname": "Test shortname 66",
        "isManaged": true,
        "isAdopted": true,
        "isConnected": true,
        "metadata": {

          "deviceType": "camera",
          "uniqueId": "00000000000000000000000c"
        },
        "guid": "00000000-0000-0000-0000-000000000034",
        "images": {

          "xs": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_25x25.png",
          "s": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_32x32.png",
          "m": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_51x51.png",
          "l": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_64x64.png",
          "xl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_101x101.png",
          "xxl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006b_128x128.png",
          "animation": [
            "icons/g6-pro-entry-close.png",
            "icons/g6-pro-entry-open.png"
          ]
        },
        "source": "protect",
        "uniqueId": "00000000000000000000000c",
        "type": "UVC G6 Pro Entry",
        "supportLicensePlate": true,
        "supportDetectLPOnly": true,
        "videoWidth": 3024,
        "videoHeight": 4096,
        "videoCodec": "h265",
        "lastSeen": 1786606805199,
        "hubMac": "",
        "smartDetectZones": [
          {

            "id": 10001,
            "name": "Test Name 17",
            "color": "#AB46BC",
            "points": [
              [
                0,
                0
              ],
              [
                1,
                0
              ],
              [
                1,
                1
              ],
              [
                0,
                1
              ]
            ],
            "sensitivity": 50,
            "objectTypes": [
              "person",
              "vehicle",
              "animal",
              "face",
              "licensePlate"
            ],
            "isTriggerLightEnabled": true,
            "triggerAccessTypes": [],
            "source": "unifi-access",
            "enableAccessLPOnlyMode": false
          }
        ],
        "allSmartDetectZones": [
          {

            "id": 1,
            "name": "Test Name 67",
            "color": "#AB46BC",
            "points": [
              [
                0,
                0
              ],
              [
                1,
                0
              ],
              [
                1,
                1
              ],
              [
                0,
                1
              ]
            ],
            "sensitivity": 50,
            "objectTypes": [
              "person",
              "vehicle",
              "animal",
              "face"
            ],
            "isTriggerLightEnabled": true,
            "triggerAccessTypes": [],
            "source": "unifi-protect",
            "enableAccessLPOnlyMode": false
          }
        ],
        "smartDetectSettings": {

          "objectTypes": [
            "person",
            "vehicle",
            "animal",
            "package",
            "face",
            "licensePlate"
          ],
          "autoTrackingObjectTypes": [],
          "autoTrackingWithZoom": true,
          "audioTypes": [
            "alrmSmoke",
            "alrmCmonx",
            "alrmSiren",
            "alrmBabyCry",
            "alrmSpeak",
            "alrmBurglar",
            "alrmCarHorn",
            "alrmBark",
            "alrmGlassBreak"
          ],
          "enableTamperDetection": false,
          "detectionRange": {

            "max": 0,
            "min": 0
          }
        },
        "supportDoorAccessConfig": true,
        "recordingSettings": {

          "mode": "always",
          "prePaddingSecs": 2,
          "postPaddingSecs": 2,
          "smartDetectPrePaddingSecs": 2,
          "smartDetectPostPaddingSecs": 2,
          "minMotionEventTrigger": 1000,
          "endMotionEventDelay": 3000,
          "suppressIlluminationSurge": false,
          "inScheduleMode": "always",
          "outScheduleMode": "never",
          "geofencing": "off",
          "motionAlgorithm": "enhanced",
          "enableMotionDetection": false,
          "createAccessEvent": true,
          "useNewMotionAlgorithm": true
        },
        "osdSettings": {

          "isNameEnabled": false,
          "isDateEnabled": true,
          "isLogoEnabled": false,
          "isDebugEnabled": false
        },
        "micVolume": 100,
        "isMicEnabled": true,
        "talkbackSettings": {

          "bindAddr": "192.0.2.14",
          "bindPort": 7004,
          "bitsPerSample": 16,
          "channels": 1,
          "filterAddr": "",
          "filterPort": 0,
          "quality": 100,
          "samplingRate": 22050,
          "typeFmt": "aac",
          "typeIn": "serverudp"
        },
        "hasSpeaker": true,
        "isWaterproofCaseAttached": false,
        "ispSettings": {

          "aeMode": "auto",
          "irLedMode": "auto",
          "irLedLevel": 255,
          "wdr": 1,
          "icrSensitivity": 0,
          "icrSwitchMode": "sensitivity",
          "icrCustomValue": 1,
          "brightness": 50,
          "contrast": 50,
          "hue": 50,
          "saturation": 50,
          "sharpness": 50,
          "denoise": 50,
          "isColorNightVisionEnabled": true,
          "spotlightDuration": 15,
          "isFlippedVertical": false,
          "isFlippedHorizontal": false,
          "isAutoRotateEnabled": false,
          "isLdcEnabled": true,
          "is3dnrEnabled": true,
          "isExternalIrEnabled": false,
          "isAggressiveAntiFlickerEnabled": false,
          "isPauseMotionEnabled": false,
          "dZoomCenterX": 50,
          "dZoomCenterY": 50,
          "dZoomScale": 0,
          "dZoomStreamId": 4,
          "focusPosition": 0,
          "touchFocusX": 1001,
          "touchFocusY": 1001,
          "zoomPosition": 0,
          "mountPosition": "ceiling",
          "hdrMode": "normal",
          "sceneMode": "auto",
          "isSmokeCoverModeEnabled": false
        },
        "isPoorNetwork": false,
        "featureFlags": {

          "smartDetectTypes": [
            "person",
            "vehicle",
            "animal",
            "package",
            "face",
            "licensePlate"
          ],
          "supportDoorAccessConfig": true,
          "supportNfc": false,
          "supportLpOnly": false,
          "supportLpDetectionWithoutVehicle": true,
          "hasMic": true,
          "hasPackageCamera": true,
          "hasPackageZoneSupportForSecondaryLens": true,
          "canOpticalZoom": false,
          "hotPlug": {

            "audio": null
          },
          "reader": {

            "supportAccessMethods": [
              "nfc",
              "touchPass",
              "pinCode",
              "btButton",
              "btTap",
              "face",
              "qrCode"
            ],
            "support2fa": false,
            "supportLocate": true,
            "supportDoorDirection": true,
            "supportCallerManager": true,
            "supportInterfaceDirectory": true,
            "supportGreetings": true,
            "supportShowInterfaceImage": true,
            "supportShowStatusBar": true,
            "supportShowHeading": true,
            "supportGateStop": true
          }
        },
        "currentResolution": "5K",
        "supportNfc": true,
        "supportTouchPass": true,
        "supportFaceUnlock": true,
        "supportBtButton": true,
        "supportBtTap": true,
        "supportQrCode": true,
        "supportPIN": true,
        "supportTwoStepAuth": false,
        "supportGreeting": true,
        "supportDirection": false,
        "supportCallerManager": true,
        "supportMobileUnlockV2": true,
        "supportCallerDirectory": true,
        "supportTwilioSip": false,
        "supportGateStop": true,
        "supportShowInterfaceImage": true,
        "supportShowStatusBar": true,
        "supportShowHeading": true,
        "isFloodlightTriggerEnabled": false,
        "stats": {

          "video": {

            "recordingStart": 1784222308652,
            "recordingEnd": 1786606834521,
            "recordingStartLQ": 1784222308652,
            "recordingEndLQ": 1786606834529
          }
        },
        "location": [],
        "configs": [
          {

            "device_id": "00000000000000000000000c",
            "key": "capture_enable",
            "value": "yes",
            "tag": "device_extra",
            "update_time": "0001-01-01T00:00:00Z",
            "create_time": "0001-01-01T00:00:00Z"
          },
          {

            "device_id": "00000000000000000000000c",
            "key": "capture",
            "value": "yes",
            "tag": "device_extra",
            "update_time": "0001-01-01T00:00:00Z",
            "create_time": "0001-01-01T00:00:00Z"
          },
          {

            "device_id": "00000000000000000000000c",
            "key": "door_entry_method",
            "value": "in",
            "tag": "door_entry_method",
            "update_time": "0001-01-01T00:00:00Z",
            "create_time": "0001-01-01T00:00:00Z"
          }
        ],
        "support_feature": [
          "capture"
        ],
        "bind_same_paired": false,
        "accessDetectZones": [],
        "isAccessReader": false
      }
    }
  },
  {

    "event": "access.data.v2.device.update",
    "receiver_id": "",
    "event_object_id": "00000000-0000-0000-0000-00000000004b",
    "save_to_history": false,
    "data": {

      "name": "Test Name 65",
      "alias": "",
      "id": "00000000000000000000000c",
      "ip": "192.0.2.13",
      "mac": "AABBCC000010",
      "online": true,
      "adopting": false,
      "device_type": "UVC G6 Pro Entry",
      "connected_hub_id": "",
      "location_id": "",
      "firmware": "5.3.95",
      "version": "",
      "guid": "00000000-0000-0000-0000-000000000034",
      "start_time": 1782282073199,
      "hw_type": "",
      "revision": "",
      "cap": [
        "capture",
        "support_register_card"
      ],
      "category": [
        "camera"
      ]
    },
    "meta": {

      "object_type": "device",
      "target_field": null,
      "all_field": true,
      "id": "00000000000000000000000c",
      "source": ""
    }
  }
];

/* Two specimens from an older controller, kept because they pin the legacy dialect's shape on firmware that predates the v2 namespace entirely: a location update
 * and a full-record device update.
 *
 * Captured from a live controller, 2024.
 */
export const accessEventPackets2024Fixture: AccessEventPacket[] = [

  {

    "event": "access.data.location.update",
    "receiver_id": "",
    "event_object_id": "00000000-0000-0000-0000-00000000004c",
    "save_to_history": false,
    "data": {

      "unique_id": "00000000-0000-0000-0000-00000000004c",
      "name": "Test Name 78",
      "up_id": "00000000-0000-0000-0000-00000000004d",
      "timezone": "",
      "location_type": "door",
      "extra_type": "",
      "full_name": "Test Name 79",
      "level": 0,
      "work_time": "[]",
      "work_time_id": "",
      "extras": {

        "door_thumbnail": "REDACTED-00000021-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        "door_thumbnail_last_update": 1709389758,
        "uah-input_state_dps": "off",
        "uah-wiring_state_dps-neg": "off",
        "uah-wiring_state_dps-pos": "off"
      }
    }
  },
  {

    "event": "access.data.device.update",
    "receiver_id": "",
    "event_object_id": "aabbcc000001",
    "save_to_history": false,
    "data": {

      "unique_id": "aabbcc000001",
      "name": "Test Name 76",
      "alias": "Test alias 80",
      "device_type": "UAH",
      "connected_uah_id": "aabbcc000001",
      "location_id": "00000000-0000-0000-0000-00000000004c",
      "firmware": "v4.4.5.0",
      "version": null,
      "ip": "192.0.2.15",
      "mac": "aa:bb:cc:00:00:01",
      "hw_type": "",
      "start_time": 1709787801,
      "security_check": false,
      "source": null,
      "bom_rev": "",
      "guid": "00000000-0000-0000-0000-000000000007",
      "need_advisory": false,
      "is_adopted": true,
      "is_managed": true,
      "is_connected": true,
      "is_online": true,
      "adopting": false,
      "location": {

        "unique_id": "00000000-0000-0000-0000-00000000004c",
        "name": "Test Name 78",
        "up_id": "00000000-0000-0000-0000-00000000004d",
        "timezone": "",
        "location_type": "door",
        "extra_type": "",
        "full_name": "Test Name 79",
        "level": 0,
        "work_time": "[]",
        "work_time_id": "",
        "extras": {

          "door_thumbnail": "REDACTED-00000022-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
          "door_thumbnail_last_update": 1709788483,
          "uah-input_state_dps": "off",
          "uah-wiring_state_dps-neg": "off",
          "uah-wiring_state_dps-pos": "off"
        }
      },
      "door": {

        "unique_id": "00000000-0000-0000-0000-00000000004c",
        "name": "Test Name 78",
        "up_id": "00000000-0000-0000-0000-00000000004d",
        "timezone": "",
        "location_type": "door",
        "extra_type": "",
        "full_name": "Test Name 79",
        "level": 0,
        "work_time": "[]",
        "work_time_id": "",
        "extras": {

          "door_thumbnail": "REDACTED-00000022-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
          "door_thumbnail_last_update": 1709788483,
          "uah-input_state_dps": "off",
          "uah-wiring_state_dps-neg": "off",
          "uah-wiring_state_dps-pos": "off"
        }
      },
      "floor": {

        "unique_id": "00000000-0000-0000-0000-00000000004d",
        "name": "Test Name 2",
        "up_id": "00000000-0000-0000-0000-00000000004e",
        "timezone": "",
        "location_type": "floor",
        "extra_type": "",
        "full_name": "Test Name 81",
        "level": 1,
        "work_time": "[]",
        "work_time_id": "",
        "extras": {}
      },
      "configs": [
        {

          "device_id": "aabbcc000001",
          "key": "wiring_state_aux-wet-com",
          "value": "off",
          "tag": "wiring_state",
          "source": ""
        },
        {

          "device_id": "aabbcc000001",
          "key": "input_state_rex",
          "value": "off",
          "tag": "input_state",
          "source": ""
        },
        {

          "device_id": "aabbcc000001",
          "key": "wiring_state_rel-pos",
          "value": "off",
          "tag": "wiring_state",
          "source": ""
        },
        {

          "device_id": "aabbcc000001",
          "key": "wiring_state_aux-dry-com",
          "value": "off",
          "tag": "wiring_state",
          "source": ""
        },
        {

          "device_id": "aabbcc000001",
          "key": "wiring_state_lock-wet-com",
          "value": "off",
          "tag": "wiring_state",
          "source": ""
        },
        {

          "device_id": "aabbcc000001",
          "key": "input_state_rel",
          "value": "off",
          "tag": "input_state",
          "source": ""
        },
        {

          "device_id": "aabbcc000001",
          "key": "wiring_state_dps-pos",
          "value": "off",
          "tag": "wiring_state",
          "source": ""
        },
        {

          "device_id": "aabbcc000001",
          "key": "hold_relay_seconds",
          "value": "5",
          "tag": "uah_config",
          "source": ""
        },
        {

          "device_id": "aabbcc000001",
          "key": "input_state_rly-lock_dry",
          "value": "on",
          "tag": "input_state",
          "source": ""
        },
        {

          "device_id": "aabbcc000001",
          "key": "wiring_state_12v-pos",
          "value": "off",
          "tag": "wiring_state",
          "source": ""
        },
        {

          "device_id": "aabbcc000001",
          "key": "wiring_state_lock-wet-nc",
          "value": "off",
          "tag": "wiring_state",
          "source": ""
        },
        {

          "device_id": "aabbcc000001",
          "key": "wiring_state_lock-dry-com",
          "value": "off",
          "tag": "wiring_state",
          "source": ""
        },
        {

          "device_id": "aabbcc000001",
          "key": "input_state_dps",
          "value": "off",
          "tag": "input_state",
          "source": ""
        },
        {

          "device_id": "aabbcc000001",
          "key": "wiring_state_aux-dry-nc",
          "value": "off",
          "tag": "wiring_state",
          "source": ""
        },
        {

          "device_id": "aabbcc000001",
          "key": "aux_delay_time",
          "value": "0.1",
          "tag": "uah_config",
          "source": ""
        },
        {

          "device_id": "aabbcc000001",
          "key": "alias",
          "value": "Test alias 80",
          "tag": "device_extra",
          "source": ""
        },
        {

          "device_id": "aabbcc000001",
          "key": "wiring_state_bitmap",
          "value": "33554432",
          "tag": "wiring_state",
          "source": ""
        },
        {

          "device_id": "aabbcc000001",
          "key": "input_state_ren",
          "value": "off",
          "tag": "input_state",
          "source": ""
        },
        {

          "device_id": "aabbcc000001",
          "key": "ssh_password",
          "value": "REDACTED-00000023-xx",
          "tag": "credential",
          "source": ""
        },
        {

          "device_id": "aabbcc000001",
          "key": "wiring_state_ren-pos",
          "value": "off",
          "tag": "wiring_state",
          "source": ""
        },
        {

          "device_id": "aabbcc000001",
          "key": "cert_fingerprint",
          "value": "000000000000000000000000000000000000000e",
          "tag": "credential",
          "source": ""
        },
        {

          "device_id": "aabbcc000001",
          "key": "aux_delay_wet",
          "value": "0.1",
          "tag": "uah_config",
          "source": ""
        },
        {

          "device_id": "aabbcc000001",
          "key": "ssh_user",
          "value": "Test username 8",
          "tag": "credential",
          "source": ""
        },
        {

          "device_id": "aabbcc000001",
          "key": "wiring_state_lock-dry-no",
          "value": "off",
          "tag": "wiring_state",
          "source": ""
        },
        {

          "device_id": "aabbcc000001",
          "key": "input_state_EMERGY",
          "value": "off",
          "tag": "input_state",
          "source": ""
        },
        {

          "device_id": "aabbcc000001",
          "key": "wiring_state_rex-pos",
          "value": "off",
          "tag": "wiring_state",
          "source": ""
        },
        {

          "device_id": "aabbcc000001",
          "key": "wiring_state_lock-dry-nc",
          "value": "off",
          "tag": "wiring_state",
          "source": ""
        },
        {

          "device_id": "aabbcc000001",
          "key": "port-mac-2",
          "value": "aa:bb:cc:00:00:02",
          "tag": "hub_action",
          "source": ""
        },
        {

          "device_id": "aabbcc000001",
          "key": "wiring_state_aux-dry-no",
          "value": "off",
          "tag": "wiring_state",
          "source": ""
        },
        {

          "device_id": "aabbcc000001",
          "key": "aux_mode_wet",
          "value": "bell",
          "tag": "uah_config",
          "source": ""
        },
        {

          "device_id": "aabbcc000001",
          "key": "wiring_state_aux-dry-cn",
          "value": "off",
          "tag": "wiring_state",
          "source": ""
        },
        {

          "device_id": "aabbcc000001",
          "key": "wiring_state_ren-neg",
          "value": "off",
          "tag": "wiring_state",
          "source": ""
        },
        {

          "device_id": "aabbcc000001",
          "key": "wiring_state_aux-wet-no",
          "value": "off",
          "tag": "wiring_state",
          "source": ""
        },
        {

          "device_id": "aabbcc000001",
          "key": "uah_token",
          "value": "REDACTED-00000024-xxxxxxxxxxxxxxxxxx",
          "tag": "uah_config",
          "source": ""
        },
        {

          "device_id": "aabbcc000001",
          "key": "wiring_state_aux-wet-nc",
          "value": "off",
          "tag": "wiring_state",
          "source": ""
        },
        {

          "device_id": "aabbcc000001",
          "key": "nacl_public_key",
          "value": "REDACTED-00000025-xxxxxxxxxxxxxxxxxxxxxxxxxx",
          "tag": "credential",
          "source": ""
        },
        {

          "device_id": "aabbcc000001",
          "key": "wiring_state_dps-neg",
          "value": "off",
          "tag": "wiring_state",
          "source": ""
        },
        {

          "device_id": "aabbcc000001",
          "key": "wiring_state_poe-p2-enter",
          "value": "on",
          "tag": "wiring_state",
          "source": ""
        },
        {

          "device_id": "aabbcc000001",
          "key": "wiring_state_rex-neg",
          "value": "off",
          "tag": "wiring_state",
          "source": ""
        },
        {

          "device_id": "aabbcc000001",
          "key": "aux_mode_dry",
          "value": "opener",
          "tag": "uah_config",
          "source": ""
        },
        {

          "device_id": "aabbcc000001",
          "key": "wiring_state_12v-neg",
          "value": "off",
          "tag": "wiring_state",
          "source": ""
        },
        {

          "device_id": "aabbcc000001",
          "key": "wiring_state_lock-wet-no",
          "value": "off",
          "tag": "wiring_state",
          "source": ""
        },
        {

          "device_id": "aabbcc000001",
          "key": "wiring_state_rel-neg",
          "value": "off",
          "tag": "wiring_state",
          "source": ""
        },
        {

          "device_id": "aabbcc000001",
          "key": "wiring_state_poe-p1-exit",
          "value": "off",
          "tag": "wiring_state",
          "source": ""
        },
        {

          "device_id": "aabbcc000001",
          "key": "wiring_state_poe-p3-camera",
          "value": "off",
          "tag": "wiring_state",
          "source": ""
        },
        {

          "device_id": "aabbcc000001",
          "key": "wiring_state_support-bitmap",
          "value": "on",
          "tag": "wiring_state",
          "source": ""
        },
        {

          "device_id": "aabbcc000001",
          "key": "poe-type",
          "value": "802.3at",
          "tag": "device_extra",
          "source": ""
        },
        {

          "device_id": "aabbcc000001",
          "key": "output_aux_mode",
          "value": "normal",
          "tag": "uah_config",
          "source": ""
        },
        {

          "device_id": "aabbcc000001",
          "key": "input_state_SW-EMERGY",
          "value": "off",
          "tag": "input_state",
          "source": ""
        }
      ],
      "update": null,
      "update_manual": {

        "device_version_upgrade_status": {

          "completed": false,
          "is_waiting": false,
          "is_upgrading": false,
          "upgrade_seconds": 0,
          "timed_out": false,
          "failed": false,
          "failure_reason": "",
          "is_downloading": false
        },
        "from_version": "",
        "last_upgrade_start_time": null,
        "last_upgrade_success": null,
        "last_upgrade_failure_reason": ""
      },
      "capabilities": [
        "pin_code",
        "dps_alarm",
        "input_mode_switch",
        "aux_alarm",
        "aux_delay_time",
        "hold_time_0.1s",
        "lock_relay_report",
        "ssh_change",
        "door_bell",
        "multi_unlock_schedule",
        "support_ui_account",
        "aux_option_change",
        "unlock_time_period",
        "incremental_update_setting",
        "mqtt_topic_update_setting"
      ],
      "resource_name": "Test Name 82",
      "display_model": "UA Hub",
      "revision": "1709788118279856447",
      "revision_update_time": 1709788128,
      "version_update_time": -62135596800,
      "firmware_update_time": -62135596800,
      "adopt_time": 1709787914,
      "model": "UA Hub",
      "images": {

        "xs": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-000000000067_25x25.png",
        "s": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-000000000067_51x51.png",
        "m": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-000000000067_101x101.png",
        "l": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-000000000067_129x129.png",
        "xl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-000000000067_257x257.png"
      }
    }
  }
];

/* Doorbell and remote-unlock specimens, recovered from the wire samples recorded in the project's own changelog history: a ring, the cancellations that ended calls
 * like it, and a remote unlock. They are the older capture generation, which is what earns them a place beside the bulk windows - this ring carries the doorbell
 * payload's required members and none of its optional ones, so the shape the type declares answers to two generations of controller rather than to one.
 *
 * Captured from a live controller, 2024.
 */
export const accessEventPacketsHistoricalFixture: AccessEventPacket[] = [

  {

    "event": "access.data.device.remote_unlock",
    "receiver_id": "",
    "event_object_id": "aabbcc000001",
    "save_to_history": false,
    "data": {

      "unique_id": "00000000-0000-0000-0000-00000000004c",
      "name": "Test Name 78",
      "up_id": "00000000-0000-0000-0000-00000000004d",
      "timezone": "",
      "location_type": "door",
      "extra_type": "",
      "full_name": "Test Name 79",
      "level": 0,
      "work_time": "[]",
      "work_time_id": "",
      "extras": {

        "door_thumbnail": "REDACTED-00000026-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        "door_thumbnail_last_update": 1709785759,
        "uah-input_state_dps": "off",
        "uah-wiring_state_dps-neg": "off",
        "uah-wiring_state_dps-pos": "off"
      }
    }
  },
  {

    "event": "access.remote_view.change",
    "receiver_id": "",
    "event_object_id": "00000000-0000-0000-0000-00000000004f",
    "save_to_history": false,
    "data": {

      "reason_code": 108,
      "remote_call_request_id": "K1W41qcaOiL63sYiZ0xPik2xo9HtUX7D"
    }
  },
  {

    "event": "access.remote_view.change",
    "receiver_id": "",
    "event_object_id": "00000000-0000-0000-0000-000000000050",
    "save_to_history": false,
    "data": {

      "reason_code": 108,
      "remote_call_request_id": "cJUK5hLG9VkEvNzl35jGTWQZ5opXpI58"
    }
  },
  {

    "event": "access.remote_view",
    "receiver_id": "",
    "event_object_id": "00000000-0000-0000-0000-000000000051",
    "save_to_history": false,
    "data": {

      "channel": "00000000-0000-0000-0000-000000000052",
      "token": "REDACTED-00000027-xxxxxxxxxxxxxxxxxx",
      "device_id": "aabbcc000002",
      "device_type": "UA-G2-PRO",
      "device_name": "Test Name 83",
      "door_name": "Test Name 78",
      "controller_id": "aabbcc000011",
      "floor_name": "Test Name 2",
      "request_id": "K1W41qcaOiL63sYiZ0xPik2xo9HtUX7D",
      "clear_request_id": "",
      "in_or_out": "in",
      "create_time": 1709785930,
      "reason_code": 0,
      "door_guard_ids": [
        "00000000-0000-0000-0000-000000000053"
      ],
      "connected_uah_id": "aabbcc000001",
      "room_id": "WR-aabbcc000002-LyYZ5tJNIOk5SSV7n3d0Lb3jrFjkP4Pj",
      "host_device_mac": "AABBCC000011",
      "support_feature": [
        "doorbell_bind"
      ],
      "connected_uah_type": "UAH"
    }
  }
];

/* An interactive capture window: one session at the door driven deliberately rather than sampled ambiently, so every packet a person's actions provoke arrives
 * together and in order. It carries a doorbell ring alongside the cancellation that ended it, credential grants and a denial with the activity-log notifications and
 * log-summary update each one raises, a remote unlock with the grant that correlates to it, and device updates carrying the state that only the newer dialect sends.
 * An ambient window pins none of it, because nothing in one is provoked.
 *
 * Captured from a live controller, 2026.
 */
export const accessEventPacketsInteractiveFixture: AccessEventPacket[] = [

  {

    "event": "access.remote_view",
    "receiver_id": "",
    "event_object_id": "00000000-0000-0000-0000-000000000054",
    "save_to_history": false,
    "data": {

      "channel": "00000000-0000-0000-0000-000000000055",
      "token": "REDACTED-00000028-xxxxxxxxxxxxxxxxxx",
      "device_id": "aabbcc000002",
      "device_type": "UA-G2-PRO",
      "device_name": "Test Name 68",
      "door_id": "00000000-0000-0000-0000-000000000006",
      "door_name": "Test Name 10",
      "controller_id": "aabbcc000012",
      "floor_name": "Test Name 2",
      "request_id": "TxC3TMGjlPk30gEYGDVsgSrIpQWWZPEb",
      "clear_request_id": "",
      "in_or_out": "in",
      "create_time": 1786729371,
      "reason_code": 0,
      "door_guard_ids": [
        "00000000-0000-0000-0000-00000000000b",
        "00000000-0000-0000-0000-00000000000c"
      ],
      "connected_uah_id": "aabbcc000001",
      "room_id": "WR-aabbcc000002-D4aKxWPrjIOp7eVbBBcfJsMtbbxVhU2n",
      "host_device_mac": "AABBCC000013",
      "console_id": "00000000000000000000000000000000000000000000000000000000000f:1457807768",
      "support_feature": [
        "doorbell_bind",
        "doorbell_timeout",
        "support_ems",
        "identity_support_ems"
      ],
      "connected_uah_type": "UAH",
      "is_double_driveway": false,
      "hub_gate_door_mode": "",
      "unlocking_not_allowed": false,
      "doorbell_channel": "",
      "disable_pickup": false,
      "send_voip": true,
      "mutable_content": true,
      "template_id": "",
      "is_camera": false,
      "has_package_camera": false
    }
  },
  {

    "event": "access.data.v2.device.update",
    "receiver_id": "",
    "event_object_id": "00000000-0000-0000-0000-000000000056",
    "save_to_history": false,
    "data": {

      "name": "Test Name 76",
      "alias": "Test alias 13",
      "id": "aabbcc000001",
      "ip": "192.0.2.16",
      "mac": "aa:bb:cc:00:00:01",
      "online": true,
      "adopting": false,
      "device_type": "UAH",
      "connected_hub_id": "",
      "location_id": "00000000-0000-0000-0000-000000000006",
      "firmware": "v4.12.19.0",
      "version": "v4.12.195",
      "guid": "00000000-0000-0000-0000-000000000007",
      "start_time": 1786727929,
      "hw_type": "",
      "revision": "1786725455291261345",
      "cap": null,
      "location_states": [
        {

          "location_id": "00000000-0000-0000-0000-000000000006",
          "lock": "unlocked",
          "dps": "none",
          "dps_connected": false,
          "unlock_suspend": {

            "status": "end",
            "unlock_type": ""
          },
          "emergency": {

            "software": "none",
            "hardware": "none"
          },
          "is_unavailable": false
        }
      ],
      "category": [
        "hub"
      ]
    },
    "meta": {

      "object_type": "device",
      "target_field": [
        "location_states"
      ],
      "all_field": false,
      "id": "aabbcc000001",
      "source": ""
    }
  },
  {

    "event": "access.logs.insights.add",
    "receiver_id": "",
    "event_object_id": "aabbcc000001",
    "save_to_history": false,
    "data": {

      "id": "",
      "log_key": "dashboard.access.door.unlock.success",
      "event_type": "access.door.unlock",
      "message": "Access Granted (Hand)",
      "published": 1786729410000,
      "result": "ACCESS",
      "metadata": {

        "actor": {

          "id": "",
          "type": "user",
          "display_name": "Test Name 84"
        },
        "authentication": {

          "id": "",
          "type": "authentication",
          "display_name": "Test Name 85",
          "credential_provider": "wave"
        },
        "building": {

          "id": "00000000-0000-0000-0000-000000000000",
          "type": "building",
          "display_name": "Test Name 1"
        },
        "device": [
          {

            "id": "aabbcc000001",
            "type": "UAH",
            "display_name": "Test Name 76"
          },
          {

            "id": "aabbcc000003",
            "type": "UA-G2-MINI",
            "display_name": "Test Name 20",
            "alternate_id": "00000000-0000-0000-0000-00000000000d",
            "alternate_name": "Test alternate_name 86"
          }
        ],
        "device_config": {

          "id": "door_entry_method",
          "type": "device_config",
          "display_name": "Test Name 87"
        },
        "device_ua_hub": {

          "id": "aabbcc000001",
          "type": "UAH",
          "display_name": "Test Name 76"
        },
        "device_ua_lite": {

          "id": "aabbcc000003",
          "type": "UA-G2-MINI",
          "display_name": "Test Name 20",
          "alternate_id": "00000000-0000-0000-0000-00000000000d",
          "alternate_name": "Test alternate_name 86"
        },
        "device_ua_reader": {

          "id": "aabbcc000003",
          "type": "UA-G2-MINI",
          "display_name": "Test Name 20",
          "alternate_id": "00000000-0000-0000-0000-00000000000d",
          "alternate_name": "Test alternate_name 86"
        },
        "door": {

          "id": "aabbcc000001",
          "type": "door",
          "display_name": "Test Name 10"
        },
        "fo": {

          "id": "00000000-0000-0000-0000-000000000001",
          "type": "floor",
          "display_name": "Test Name 2"
        },
        "opened_direction": {

          "id": "door_entry_method",
          "type": "device_config",
          "display_name": "Test Name 87"
        },
        "opened_method": {

          "id": "",
          "type": "opened_method",
          "display_name": "Test Name 88"
        },
        "reason_code": {

          "id": "0",
          "type": "reason_code",
          "display_name": ""
        },
        "three_button_method": {

          "id": "",
          "type": "three_button_method",
          "display_name": ""
        }
      }
    }
  },
  {

    "event": "access.logs.add",
    "receiver_id": "",
    "event_object_id": "aabbcc000001",
    "save_to_history": false,
    "data": {

      "_id": "",
      "@timestamp": "",
      "_source": {

        "actor": {

          "id": "",
          "type": "user",
          "display_name": "Test Name 89"
        },
        "event": {

          "type": "access.door.unlock",
          "display_message": "Access Granted (Hand)",
          "result": "ACCESS",
          "published": 1786729410000,
          "log_key": "dashboard.access.door.unlock.success",
          "log_category": "Unlocks",
          "level": 0,
          "event": ""
        },
        "authentication": {

          "credential_provider": "WAVE"
        },
        "target": [
          {

            "type": "UAH",
            "id": "aabbcc000001",
            "display_name": "Test Name 76"
          },
          {

            "type": "device_config",
            "id": "door_entry_method",
            "display_name": "Test Name 87"
          },
          {

            "type": "reason_code",
            "id": "0",
            "display_name": ""
          },
          {

            "type": "three_button_method",
            "id": "",
            "display_name": ""
          },
          {

            "type": "UA-G2-MINI",
            "id": "aabbcc000003",
            "display_name": "Test Name 20",
            "alternate_id": "00000000-0000-0000-0000-00000000000d",
            "alternate_name": "Test alternate_name 86"
          },
          {

            "type": "door",
            "id": "aabbcc000001",
            "display_name": "Test Name 10"
          },
          {

            "type": "floor",
            "id": "00000000-0000-0000-0000-000000000001",
            "display_name": "Test Name 2"
          },
          {

            "type": "building",
            "id": "00000000-0000-0000-0000-000000000000",
            "display_name": "Test Name 1"
          }
        ]
      },
      "tag": "access"
    }
  },
  {

    "event": "access.remote_view.change",
    "receiver_id": "",
    "event_object_id": "00000000-0000-0000-0000-000000000057",
    "save_to_history": false,
    "data": {

      "reason_code": 105,
      "remote_call_request_id": "TxC3TMGjlPk30gEYGDVsgSrIpQWWZPEb"
    }
  },
  {

    "event": "access.data.top_log.update",
    "receiver_id": "",
    "event_object_id": "00000000-0000-0000-0000-000000000058",
    "save_to_history": false,
    "data": {

      "hits": [],
      "buckets": null
    }
  },
  {

    "event": "access.logs.insights.add",
    "receiver_id": "",
    "event_object_id": "aabbcc000001",
    "save_to_history": false,
    "data": {

      "id": "",
      "log_key": "dashboard.access.door.unlock.failed",
      "event_type": "access.door.unlock",
      "message": "Access Denied / Unknown (NFC)",
      "published": 1786729565000,
      "result": "BLOCKED",
      "metadata": {

        "actor": {

          "id": "",
          "type": "user",
          "display_name": "Test Name 84"
        },
        "authentication": {

          "id": "c9a2b8b1",
          "type": "authentication",
          "display_name": "Test Name 90",
          "credential_provider": "nfc"
        },
        "building": {

          "id": "00000000-0000-0000-0000-000000000000",
          "type": "building",
          "display_name": "Test Name 1"
        },
        "device": [
          {

            "id": "aabbcc000001",
            "type": "UAH",
            "display_name": "Test Name 76"
          },
          {

            "id": "aabbcc000002",
            "type": "UA-G2-PRO",
            "display_name": "Test Name 68",
            "alternate_id": "00000000-0000-0000-0000-000000000009",
            "alternate_name": "Test alternate_name 86"
          }
        ],
        "device_config": {

          "id": "door_entry_method",
          "type": "device_config",
          "display_name": "Test Name 91"
        },
        "device_ua_hub": {

          "id": "aabbcc000001",
          "type": "UAH",
          "display_name": "Test Name 76"
        },
        "device_ua_pro": {

          "id": "aabbcc000002",
          "type": "UA-G2-PRO",
          "display_name": "Test Name 68",
          "alternate_id": "00000000-0000-0000-0000-000000000009",
          "alternate_name": "Test alternate_name 86"
        },
        "device_ua_reader": {

          "id": "aabbcc000002",
          "type": "UA-G2-PRO",
          "display_name": "Test Name 68",
          "alternate_id": "00000000-0000-0000-0000-000000000009",
          "alternate_name": "Test alternate_name 86"
        },
        "door": {

          "id": "aabbcc000001",
          "type": "door",
          "display_name": "Test Name 10"
        },
        "fo": {

          "id": "00000000-0000-0000-0000-000000000001",
          "type": "floor",
          "display_name": "Test Name 2"
        },
        "nfc": {

          "id": "08055283",
          "type": "NFC",
          "display_name": "Test Name 92"
        },
        "nfc_id": {

          "id": "08055283",
          "type": "nfc_id",
          "display_name": "Test Name 93"
        },
        "opened_direction": {

          "id": "door_entry_method",
          "type": "device_config",
          "display_name": "Test Name 91"
        },
        "opened_method": {

          "id": "",
          "type": "opened_method",
          "display_name": "Test Name 94"
        },
        "reason_code": {

          "id": "101",
          "type": "reason_code",
          "display_name": ""
        },
        "three_button_method": {

          "id": "",
          "type": "three_button_method",
          "display_name": ""
        },
        "unlock_source": {

          "id": "l2",
          "type": "unlock_source",
          "display_name": "Test Name 95"
        }
      }
    }
  },
  {

    "event": "access.logs.add",
    "receiver_id": "",
    "event_object_id": "aabbcc000001",
    "save_to_history": false,
    "data": {

      "_id": "",
      "@timestamp": "",
      "_source": {

        "actor": {

          "id": "",
          "type": "user",
          "display_name": "Test Name 89"
        },
        "event": {

          "type": "access.door.unlock",
          "display_message": "Access Denied / Unknown (NFC)",
          "result": "BLOCKED",
          "published": 1786729565000,
          "log_key": "dashboard.access.door.unlock.failed",
          "log_category": "Access Denial",
          "level": 0,
          "event": ""
        },
        "authentication": {

          "credential_provider": "NFC",
          "issuer": "c9a2b8b1"
        },
        "target": [
          {

            "type": "UAH",
            "id": "aabbcc000001",
            "display_name": "Test Name 76"
          },
          {

            "type": "device_config",
            "id": "door_entry_method",
            "display_name": "Test Name 91"
          },
          {

            "type": "reason_code",
            "id": "101",
            "display_name": ""
          },
          {

            "type": "three_button_method",
            "id": "",
            "display_name": ""
          },
          {

            "type": "UA-G2-PRO",
            "id": "aabbcc000002",
            "display_name": "Test Name 68",
            "alternate_id": "00000000-0000-0000-0000-000000000009",
            "alternate_name": "Test alternate_name 86"
          },
          {

            "type": "door",
            "id": "aabbcc000001",
            "display_name": "Test Name 10"
          },
          {

            "type": "floor",
            "id": "00000000-0000-0000-0000-000000000001",
            "display_name": "Test Name 2"
          },
          {

            "type": "building",
            "id": "00000000-0000-0000-0000-000000000000",
            "display_name": "Test Name 1"
          },
          {

            "type": "nfc_id",
            "id": "08055283",
            "display_name": "Test Name 93"
          },
          {

            "type": "NFC",
            "id": "08055283",
            "display_name": "Test Name 92"
          },
          {

            "type": "unlock_source",
            "id": "l2",
            "display_name": "Test Name 95"
          }
        ]
      },
      "tag": "access"
    }
  },
  {

    "event": "access.data.v2.device.update",
    "receiver_id": "",
    "event_object_id": "00000000-0000-0000-0000-000000000059",
    "save_to_history": false,
    "data": {

      "name": "Test Name 76",
      "alias": "Test alias 13",
      "id": "aabbcc000001",
      "ip": "192.0.2.16",
      "mac": "aa:bb:cc:00:00:01",
      "online": true,
      "adopting": false,
      "device_type": "UAH",
      "connected_hub_id": "",
      "location_id": "00000000-0000-0000-0000-000000000006",
      "firmware": "v4.12.19.0",
      "version": "v4.12.195",
      "guid": "00000000-0000-0000-0000-000000000007",
      "start_time": 1786727929,
      "hw_type": "",
      "revision": "1786729544053878905",
      "wire_state": {

        "wiring_state_12v-neg": "off",
        "wiring_state_12v-pos": "off",
        "wiring_state_aux-dry-com": "off",
        "wiring_state_aux-dry-nc": "off",
        "wiring_state_aux-dry-no": "off",
        "wiring_state_aux-wet-com": "off",
        "wiring_state_aux-wet-nc": "off",
        "wiring_state_aux-wet-no": "off",
        "wiring_state_dps-neg": "off",
        "wiring_state_dps-pos": "off",
        "wiring_state_lock-dry-com": "off",
        "wiring_state_lock-dry-nc": "off",
        "wiring_state_lock-dry-no": "off",
        "wiring_state_lock-wet-com": "off",
        "wiring_state_lock-wet-nc": "off",
        "wiring_state_lock-wet-no": "off",
        "wiring_state_poe-p1-exit": "on",
        "wiring_state_poe-p2-enter": "off",
        "wiring_state_poe-p3-camera": "on",
        "wiring_state_rel-neg": "off",
        "wiring_state_rel-pos": "off",
        "wiring_state_ren-neg": "off",
        "wiring_state_ren-pos": "off",
        "wiring_state_rex-neg": "off",
        "wiring_state_rex-pos": "off"
      },
      "cap": [
        "unlock_failure_limit",
        "emergency_settings",
        "user_access_control",
        "visitor_access_control",
        "schedule_v1",
        "unlock_schedule",
        "get_da_config_v2",
        "incremental_update_user_token",
        "pin_code",
        "dps_alarm",
        "input_mode_switch",
        "aux_alarm",
        "aux_delay_time",
        "hold_time_0.1s",
        "lock_relay_report",
        "ssh_change",
        "door_bell",
        "multi_unlock_schedule",
        "support_ui_account",
        "aux_option_change",
        "unlock_time_period",
        "incremental_update_setting",
        "mqtt_topic_update_setting",
        "identity_mobile_unlock_v2",
        "user_remote_unlock",
        "two_factor_auth"
      ],
      "location_states": [
        {

          "location_id": "00000000-0000-0000-0000-000000000006",
          "lock": "locked",
          "dps": "none",
          "dps_connected": false,
          "unlock_suspend": {

            "status": "end",
            "unlock_type": ""
          },
          "emergency": {

            "software": "none",
            "hardware": "none"
          },
          "is_unavailable": false
        }
      ],
      "settings": [
        {

          "key": "ren_button_mode",
          "tag": "uah_config",
          "value": "push"
        },
        {

          "key": "input_ren_mode",
          "tag": "uah_config",
          "value": "no"
        },
        {

          "key": "input_rex_mode",
          "tag": "uah_config",
          "value": "no"
        },
        {

          "key": "dps_mode",
          "tag": "uah_config",
          "value": "no"
        },
        {

          "key": "input_rel_mode",
          "tag": "uah_config",
          "value": "no"
        }
      ],
      "category": [
        "hub"
      ]
    },
    "meta": {

      "object_type": "device",
      "target_field": null,
      "all_field": true,
      "id": "aabbcc000001",
      "source": ""
    }
  },
  {

    "event": "access.data.device.remote_unlock",
    "receiver_id": "",
    "event_object_id": "aabbcc000001",
    "save_to_history": false,
    "data": {

      "unique_id": "00000000-0000-0000-0000-000000000006",
      "name": "Test Name 10",
      "up_id": "00000000-0000-0000-0000-000000000001",
      "timezone": "",
      "location_type": "door",
      "extra_type": "",
      "full_name": "Test Name 11",
      "level": 0,
      "work_time": "[]",
      "work_time_id": "",
      "extras": {

        "door_thumbnail": "REDACTED-00000029-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        "door_thumbnail_last_update": 1786729565,
        "uah-input_state_dps": "off",
        "uah-wiring_state_dps-neg": "off",
        "uah-wiring_state_dps-pos": "off"
      },
      "previous_name": null
    }
  },
  {

    "event": "access.logs.insights.add",
    "receiver_id": "",
    "event_object_id": "aabbcc000001",
    "save_to_history": false,
    "data": {

      "id": "",
      "log_key": "dashboard.access.door.unlock.success",
      "event_type": "access.door.unlock",
      "message": "Access Granted (Remote)",
      "published": 1786729619000,
      "result": "ACCESS",
      "metadata": {

        "actor": {

          "id": "00000000-0000-0000-0000-00000000000b",
          "type": "user",
          "display_name": "Test Name 69",
          "first_name": "Test first_name 70",
          "last_name": "Test last_name 71"
        },
        "authentication": {

          "id": "",
          "type": "authentication",
          "display_name": "Test Name 96",
          "credential_provider": "remote_through_uah"
        },
        "building": {

          "id": "00000000-0000-0000-0000-000000000000",
          "type": "building",
          "display_name": "Test Name 1"
        },
        "device": {

          "id": "aabbcc000001",
          "type": "UAH",
          "display_name": "Test Name 76"
        },
        "device_config": {

          "id": "door_entry_method",
          "type": "device_config",
          "display_name": "Test Name 91"
        },
        "device_ua_hub": {

          "id": "aabbcc000001",
          "type": "UAH",
          "display_name": "Test Name 76"
        },
        "door": {

          "id": "aabbcc000001",
          "type": "door",
          "display_name": "Test Name 10"
        },
        "fo": {

          "id": "00000000-0000-0000-0000-000000000001",
          "type": "floor",
          "display_name": "Test Name 2"
        },
        "opened_direction": {

          "id": "door_entry_method",
          "type": "device_config",
          "display_name": "Test Name 91"
        },
        "opened_method": {

          "id": "",
          "type": "opened_method",
          "display_name": "Test Name 97"
        },
        "reason_code": {

          "id": "0",
          "type": "reason_code",
          "display_name": ""
        },
        "three_button_method": {

          "id": "",
          "type": "three_button_method",
          "display_name": ""
        },
        "user_status": {

          "id": "",
          "type": "user_status",
          "display_name": "Test Name 98"
        }
      }
    }
  },
  {

    "event": "access.logs.add",
    "receiver_id": "",
    "event_object_id": "aabbcc000001",
    "save_to_history": false,
    "data": {

      "_id": "",
      "@timestamp": "",
      "_source": {

        "actor": {

          "id": "00000000-0000-0000-0000-00000000000b",
          "type": "user",
          "display_name": "Test Name 69",
          "first_name": "Test first_name 70",
          "last_name": "Test last_name 71"
        },
        "event": {

          "type": "access.door.unlock",
          "display_message": "Access Granted (Remote)",
          "result": "ACCESS",
          "published": 1786729619000,
          "log_key": "dashboard.access.door.unlock.success",
          "log_category": "Unlocks",
          "level": 0,
          "event": ""
        },
        "authentication": {

          "credential_provider": "REMOTE_THROUGH_UAH"
        },
        "target": [
          {

            "type": "UAH",
            "id": "aabbcc000001",
            "display_name": "Test Name 76"
          },
          {

            "type": "device_config",
            "id": "door_entry_method",
            "display_name": "Test Name 91"
          },
          {

            "type": "reason_code",
            "id": "0",
            "display_name": ""
          },
          {

            "type": "three_button_method",
            "id": "",
            "display_name": ""
          },
          {

            "type": "door",
            "id": "aabbcc000001",
            "display_name": "Test Name 10"
          },
          {

            "type": "floor",
            "id": "00000000-0000-0000-0000-000000000001",
            "display_name": "Test Name 2"
          },
          {

            "type": "building",
            "id": "00000000-0000-0000-0000-000000000000",
            "display_name": "Test Name 1"
          },
          {

            "type": "user_status",
            "id": "",
            "display_name": "Test Name 98"
          }
        ]
      },
      "tag": "access"
    }
  }
];

/* A Door Mini capture window: one hub driving one door, worked through its lock and position states deliberately, so the door-state payloads arrive in a sequence
 * rather than as isolated samples. It carries both newer-dialect carriers of that state - a device update arraying its doors under location_states, and the door
 * location update sending the same shape as its own state - across locked and unlocked, closed and open, with and without a force-unlock alarm, so an entry that
 * omits an optional member and the same door reporting it are both present. The legacy device update beside them carries the door position in its configuration
 * rows instead, which is the older dialect the door-state modeling deliberately leaves untranslated.
 *
 * Captured from a live controller, 2026.
 */
export const accessEventPacketsDoorStateFixture: AccessEventPacket[] = [

  {

    "event": "access.data.v2.device.update",
    "receiver_id": "",
    "event_object_id": "00000000-0000-0000-0000-00000000005a",
    "save_to_history": false,
    "data": {

      "name": "Test Name 24",
      "alias": "Test alias 25",
      "id": "aabbcc000004",
      "ip": "192.0.2.17",
      "mac": "aa:bb:cc:00:00:04",
      "online": true,
      "adopting": false,
      "device_type": "UA-Hub-Door-Mini",
      "connected_hub_id": "",
      "location_id": "00000000-0000-0000-0000-00000000000e",
      "firmware": "v1.5.16.0",
      "version": "",
      "guid": "00000000-0000-0000-0000-00000000000f",
      "start_time": 1786742713,
      "hw_type": "GA",
      "revision": "1786742728627098717",
      "cap": null,
      "location_states": [
        {

          "location_id": "00000000-0000-0000-0000-00000000000e",
          "lock": "locked",
          "dps": "close",
          "dps_connected": true,
          "emergency": {

            "software": "none",
            "hardware": "none"
          },
          "is_unavailable": false
        }
      ],
      "category": [
        "hub"
      ]
    },
    "meta": {

      "object_type": "device",
      "target_field": [
        "location_states"
      ],
      "all_field": false,
      "id": "aabbcc000004",
      "source": ""
    }
  },
  {

    "event": "access.data.v2.device.update",
    "receiver_id": "",
    "event_object_id": "00000000-0000-0000-0000-00000000005b",
    "save_to_history": false,
    "data": {

      "name": "Test Name 24",
      "alias": "Test alias 25",
      "id": "aabbcc000004",
      "ip": "192.0.2.17",
      "mac": "aa:bb:cc:00:00:04",
      "online": true,
      "adopting": false,
      "device_type": "UA-Hub-Door-Mini",
      "connected_hub_id": "",
      "location_id": "00000000-0000-0000-0000-00000000000e",
      "firmware": "v1.5.16.0",
      "version": "",
      "guid": "00000000-0000-0000-0000-00000000000f",
      "start_time": 1786742713,
      "hw_type": "GA",
      "revision": "1786743792142371938",
      "cap": null,
      "location_states": [
        {

          "location_id": "00000000-0000-0000-0000-00000000000e",
          "lock": "locked",
          "dps": "open",
          "dps_connected": true,
          "alarms": [
            {

              "type": "force_unlock"
            }
          ],
          "emergency": {

            "software": "none",
            "hardware": "none"
          },
          "is_unavailable": false
        }
      ],
      "category": [
        "hub"
      ]
    },
    "meta": {

      "object_type": "device",
      "target_field": [
        "location_states"
      ],
      "all_field": false,
      "id": "aabbcc000004",
      "source": ""
    }
  },
  {

    "event": "access.data.v2.location.update",
    "receiver_id": "",
    "event_object_id": "00000000-0000-0000-0000-00000000005c",
    "save_to_history": false,
    "data": {

      "id": "00000000-0000-0000-0000-00000000000e",
      "location_type": "door",
      "name": "Test Name 22",
      "up_id": "00000000-0000-0000-0000-000000000001",
      "extras": null,
      "device_ids": [
        "aabbcc000004"
      ],
      "state": {

        "lock": "locked",
        "dps": "open",
        "dps_connected": true,
        "alarms": [
          {

            "type": "force_unlock"
          }
        ],
        "emergency": {

          "software": "none",
          "hardware": "none"
        },
        "is_unavailable": false
      },
      "thumbnail": {

        "type": "none",
        "url": "",
        "door_thumbnail_last_update": 0
      },
      "last_activity": 1786743734
    },
    "meta": {

      "object_type": "location",
      "target_field": null,
      "all_field": true,
      "id": "00000000-0000-0000-0000-00000000000e",
      "source": ""
    }
  },
  {

    "event": "access.data.device.update",
    "receiver_id": "",
    "event_object_id": "aabbcc000004",
    "save_to_history": false,
    "data": {

      "unique_id": "aabbcc000004",
      "name": "Test Name 24",
      "alias": "Test alias 25",
      "device_type": "UA-Hub-Door-Mini",
      "connected_uah_id": "",
      "location_id": "00000000-0000-0000-0000-00000000000e",
      "firmware": "v1.5.16.0",
      "version": "",
      "ip": "192.0.2.17",
      "mac": "aa:bb:cc:00:00:04",
      "hw_type": "GA",
      "start_time": 1786742713,
      "last_seen": 1764008026,
      "security_check": true,
      "source": "",
      "bom_rev": "",
      "guid": "00000000-0000-0000-0000-00000000000f",
      "need_advisory": false,
      "is_camera": false,
      "is_adopted": true,
      "is_managed": true,
      "is_connected": true,
      "is_online": true,
      "is_rebooting": false,
      "is_unavailable": false,
      "is_upgrade_blocked": false,
      "is_export_sf_blocked": false,
      "adopting": false,
      "location": {

        "unique_id": "00000000-0000-0000-0000-00000000000e",
        "name": "Test Name 22",
        "up_id": "00000000-0000-0000-0000-000000000001",
        "timezone": "",
        "location_type": "door",
        "extra_type": "",
        "full_name": "Test Name 23",
        "level": 0,
        "work_time": "[]",
        "work_time_id": "",
        "extras": {},
        "previous_name": null
      },
      "door": {

        "unique_id": "00000000-0000-0000-0000-00000000000e",
        "name": "Test Name 22",
        "up_id": "00000000-0000-0000-0000-000000000001",
        "timezone": "",
        "location_type": "door",
        "extra_type": "",
        "full_name": "Test Name 23",
        "level": 0,
        "work_time": "[]",
        "work_time_id": "",
        "extras": {},
        "previous_name": null
      },
      "floor": {

        "unique_id": "00000000-0000-0000-0000-000000000001",
        "name": "Test Name 2",
        "up_id": "00000000-0000-0000-0000-000000000000",
        "timezone": "",
        "location_type": "floor",
        "extra_type": "",
        "full_name": "Test Name 3",
        "level": 1,
        "work_time": "[]",
        "work_time_id": "",
        "extras": {},
        "previous_name": null
      },
      "configs": [
        {

          "device_id": "aabbcc000004",
          "key": "alias",
          "value": "Test alias 25",
          "tag": "device_extra",
          "update_time": "2025-06-14T11:36:56-05:00",
          "create_time": "2025-05-26T09:45:39-05:00"
        },
        {

          "device_id": "aabbcc000004",
          "key": "power_d1_ma",
          "value": "0",
          "tag": "hub_power",
          "update_time": "2025-08-08T22:55:26-05:00",
          "create_time": "2025-08-08T17:55:26-05:00"
        },
        {

          "device_id": "aabbcc000004",
          "key": "power_d1_mw",
          "value": "0",
          "tag": "hub_power",
          "update_time": "2025-08-08T22:55:26-05:00",
          "create_time": "2025-08-08T17:55:26-05:00"
        },
        {

          "device_id": "aabbcc000004",
          "key": "power_d1_ocp",
          "value": "false",
          "tag": "hub_power",
          "update_time": "2025-08-08T22:55:26-05:00",
          "create_time": "2025-08-08T17:55:26-05:00"
        },
        {

          "device_id": "aabbcc000004",
          "key": "power_poe_p1_mw",
          "value": "0",
          "tag": "hub_power",
          "update_time": "2025-08-08T22:55:26-05:00",
          "create_time": "2025-08-08T17:55:26-05:00"
        },
        {

          "device_id": "aabbcc000004",
          "key": "power_budget_mw",
          "value": "22000",
          "tag": "hub_power",
          "update_time": "2025-08-08T22:55:26-05:00",
          "create_time": "2025-08-08T17:55:26-05:00"
        },
        {

          "device_id": "aabbcc000004",
          "key": "power_total_used_12v_mw",
          "value": "0",
          "tag": "hub_power",
          "update_time": "2025-08-08T22:55:26-05:00",
          "create_time": "2025-08-08T17:55:26-05:00"
        },
        {

          "device_id": "aabbcc000004",
          "key": "ssh_user",
          "value": "Test username 8",
          "tag": "credential",
          "update_time": "2025-05-26T14:45:39-05:00",
          "create_time": "2025-05-26T09:45:39-05:00"
        },
        {

          "device_id": "aabbcc000004",
          "key": "cert_fingerprint",
          "value": "0000000000000000000000000000000000000005",
          "tag": "credential",
          "update_time": "2025-05-26T14:45:39-05:00",
          "create_time": "2025-05-26T09:45:39-05:00"
        },
        {

          "device_id": "aabbcc000004",
          "key": "nacl_public_key",
          "value": "REDACTED-0000000e-xxxxxxxxxxxxxxxxxxxxxxxxxx",
          "tag": "credential",
          "update_time": "2025-05-26T14:45:40-05:00",
          "create_time": "2025-05-26T09:45:40-05:00"
        },
        {

          "device_id": "aabbcc000004",
          "key": "poe-type",
          "value": "802.3at",
          "tag": "device_extra",
          "update_time": "2025-05-26T14:45:42-05:00",
          "create_time": "2025-05-26T09:45:42-05:00"
        },
        {

          "device_id": "aabbcc000004",
          "key": "wiring_state_d1-power-sw",
          "value": "off",
          "tag": "wiring_state",
          "update_time": "2025-05-26T14:48:54-05:00",
          "create_time": "2025-05-26T09:48:54-05:00"
        },
        {

          "device_id": "aabbcc000004",
          "key": "wiring_state_d1-button-neg",
          "value": "off",
          "tag": "wiring_state",
          "update_time": "2025-05-26T14:48:54-05:00",
          "create_time": "2025-05-26T09:48:54-05:00"
        },
        {

          "device_id": "aabbcc000004",
          "key": "wiring_state_d1-lock-nc",
          "value": "off",
          "tag": "wiring_state",
          "update_time": "2025-05-26T14:48:54-05:00",
          "create_time": "2025-05-26T09:48:54-05:00"
        },
        {

          "device_id": "aabbcc000004",
          "key": "wiring_state_d1-lock-com",
          "value": "off",
          "tag": "wiring_state",
          "update_time": "2025-05-26T14:48:54-05:00",
          "create_time": "2025-05-26T09:48:54-05:00"
        },
        {

          "device_id": "aabbcc000004",
          "key": "wiring_state_d1-lock-no",
          "value": "off",
          "tag": "wiring_state",
          "update_time": "2025-05-26T14:48:54-05:00",
          "create_time": "2025-05-26T09:48:54-05:00"
        },
        {

          "device_id": "aabbcc000004",
          "key": "wiring_state_poe-p0",
          "value": "on",
          "tag": "wiring_state",
          "update_time": "2025-05-26T14:48:54-05:00",
          "create_time": "2025-05-26T09:48:54-05:00"
        },
        {

          "device_id": "aabbcc000004",
          "key": "input_d1_button",
          "value": "off",
          "tag": "hub_action",
          "update_time": "2025-05-26T16:03:54-05:00",
          "create_time": "2025-05-26T11:03:54-05:00"
        },
        {

          "device_id": "aabbcc000004",
          "key": "output_d1_lock_relay",
          "value": "off",
          "tag": "hub_action",
          "update_time": "2025-05-26T16:03:54-05:00",
          "create_time": "2025-05-26T11:03:54-05:00"
        },
        {

          "device_id": "aabbcc000004",
          "key": "input_d1_dps",
          "value": "on",
          "tag": "hub_action",
          "update_time": "2025-05-26T21:13:54-05:00",
          "create_time": "2025-05-26T11:03:54-05:00"
        },
        {

          "device_id": "aabbcc000004",
          "key": "wiring_state_poe-p1",
          "value": "off",
          "tag": "wiring_state",
          "update_time": "2025-07-04T22:37:54-05:00",
          "create_time": "2025-05-26T09:48:54-05:00"
        },
        {

          "device_id": "aabbcc000004",
          "key": "ssh_password",
          "value": "REDACTED-0000000f-xx",
          "tag": "credential",
          "update_time": "2025-11-01T05:00:06-05:00",
          "create_time": "2025-05-26T09:45:39-05:00"
        },
        {

          "device_id": "aabbcc000004",
          "key": "wiring_state_d1-button-pos",
          "value": "off",
          "tag": "wiring_state",
          "update_time": "2025-06-15T21:19:02-05:00",
          "create_time": "2025-05-26T09:48:54-05:00"
        },
        {

          "device_id": "aabbcc000004",
          "key": "power_d1_mv",
          "value": "0",
          "tag": "hub_power",
          "update_time": "2025-11-07T14:05:03-06:00",
          "create_time": "2025-08-08T17:55:26-05:00"
        },
        {

          "device_id": "aabbcc000004",
          "key": "wiring_state_bitmap",
          "value": "2496",
          "tag": "wiring_state",
          "update_time": "2026-08-14T16:41:25-05:00",
          "create_time": "2025-05-26T09:45:42-05:00"
        },
        {

          "device_id": "aabbcc000004",
          "key": "power_free_budget_mw",
          "value": "22000",
          "tag": "hub_power",
          "update_time": "2026-08-14T16:21:36-05:00",
          "create_time": "2025-08-08T17:55:26-05:00"
        },
        {

          "device_id": "aabbcc000004",
          "key": "wiring_state_poe-p2",
          "value": "off",
          "tag": "wiring_state",
          "update_time": "2026-08-14T16:21:36-05:00",
          "create_time": "2025-05-26T09:48:54-05:00"
        },
        {

          "device_id": "aabbcc000004",
          "key": "power_poe_p2_mw",
          "value": "0",
          "tag": "hub_power",
          "update_time": "2026-08-14T16:21:36-05:00",
          "create_time": "2025-08-08T17:55:26-05:00"
        },
        {

          "device_id": "aabbcc000004",
          "key": "wiring_state_d1-dps-neg",
          "value": "on",
          "tag": "wiring_state",
          "update_time": "2026-08-14T16:41:36-05:00",
          "create_time": "2025-05-26T09:48:54-05:00"
        },
        {

          "device_id": "aabbcc000004",
          "key": "wiring_state_d1-dps-pos",
          "value": "on",
          "tag": "wiring_state",
          "update_time": "2026-08-14T16:41:36-05:00",
          "create_time": "2025-05-26T09:48:54-05:00"
        },
        {

          "device_id": "aabbcc000004",
          "key": "power_total_used_poe_mw",
          "value": "0",
          "tag": "hub_power",
          "update_time": "2026-08-14T16:21:36-05:00",
          "create_time": "2025-08-08T17:55:26-05:00"
        },
        {

          "device_id": "aabbcc000004",
          "key": "nacl_private_key",
          "value": "REDACTED-0000002a-xxxxxxxxxxxxxxxxxxxxxxxxxx",
          "tag": "credential",
          "update_time": "2026-08-14T16:25:28-05:00",
          "create_time": "2026-08-14T16:25:28-05:00"
        }
      ],
      "update": null,
      "update_manual": {

        "device_version_upgrade_status": {

          "completed": false,
          "is_waiting": false,
          "is_preparing": false,
          "is_upgrading": false,
          "upgrade_seconds": 0,
          "timed_out": false,
          "failed": false,
          "failure_reason": "",
          "is_downloading": false
        },
        "device_type": "",
        "from_version": "",
        "last_upgrade_start_time": null,
        "last_upgrade_success": null,
        "last_upgrade_failure_reason": "",
        "last_download_start_time": null,
        "last_download_success": null,
        "last_download_failure_reason": "",
        "downloaded": false
      },
      "capabilities": [
        "ssh_change",
        "support_ui_account",
        "is_hub",
        "identity_is_hub",
        "incremental_update_setting",
        "pin_code",
        "support_reboot",
        "first_person_in",
        "unlock_schedule",
        "mobile_unlock_ver2",
        "dps_trigger_level",
        "unlock_time_period_v2",
        "report_viewer_id",
        "nfc_card_easy_provision",
        "two_factor_auth",
        "power_state",
        "double_badge",
        "unlock_suspend",
        "any_auth_type",
        "location_state"
      ],
      "resource_name": "Test Name 26",
      "display_model": "UA Hub Door Mini",
      "revision": "1786742728627098717",
      "revision_update_time": 1786742736,
      "version_update_time": -62135596800,
      "firmware_update_time": -62135596800,
      "adopt_time": 1748270739,
      "extensions": [
        {

          "unique_id": "00000000-0000-0000-0000-000000000010",
          "device_id": "aabbcc000004",
          "extension_name": "port_setting",
          "source_id": "port1",
          "target_type": "door",
          "target_value": "00000000-0000-0000-0000-00000000000e",
          "target_name": "Test Name 22",
          "target_config": [
            {

              "config_tag": "device_setting",
              "config_key": "lock_unlock_time",
              "config_value": 5
            },
            {

              "config_tag": "device_setting",
              "config_key": "button_reverse",
              "config_value": false
            },
            {

              "config_tag": "device_setting",
              "config_key": "is_relay_nc",
              "config_value": false
            },
            {

              "config_tag": "device_setting",
              "config_key": "dps_reverse",
              "config_value": false
            }
          ]
        }
      ],
      "model": "UA Hub Door Mini",
      "images": {

        "xs": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006c_25x25.png",
        "s": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006c_32x32.png",
        "m": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006c_51x51.png",
        "l": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006c_64x64.png",
        "xl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006c_101x101.png",
        "xxl": "https://host-1.test.local/fingerprint/ui/icons/00000000-0000-0000-0000-00000000006c_128x128.png",
        "base": "icons/00000000-0000-0000-0000-00000000006c_257x257.png"
      },
      "provision_time": "0",
      "provision_percent": "0",
      "template": null
    }
  },
  {

    "event": "access.data.v2.device.update",
    "receiver_id": "",
    "event_object_id": "00000000-0000-0000-0000-00000000005d",
    "save_to_history": false,
    "data": {

      "name": "Test Name 24",
      "alias": "Test alias 25",
      "id": "aabbcc000004",
      "ip": "192.0.2.17",
      "mac": "aa:bb:cc:00:00:04",
      "online": true,
      "adopting": false,
      "device_type": "UA-Hub-Door-Mini",
      "connected_hub_id": "",
      "location_id": "00000000-0000-0000-0000-00000000000e",
      "firmware": "v1.5.16.0",
      "version": "",
      "guid": "00000000-0000-0000-0000-00000000000f",
      "start_time": 1786742712,
      "hw_type": "GA",
      "revision": "1786743792142371938",
      "cap": null,
      "location_states": [
        {

          "location_id": "00000000-0000-0000-0000-00000000000e",
          "lock": "unlocked",
          "dps": "open",
          "dps_connected": true,
          "emergency": {

            "software": "none",
            "hardware": "none"
          },
          "is_unavailable": false
        }
      ],
      "category": [
        "hub"
      ]
    },
    "meta": {

      "object_type": "device",
      "target_field": [
        "location_states"
      ],
      "all_field": false,
      "id": "aabbcc000004",
      "source": ""
    }
  },
  {

    "event": "access.data.v2.location.update",
    "receiver_id": "",
    "event_object_id": "00000000-0000-0000-0000-00000000005e",
    "save_to_history": false,
    "data": {

      "id": "00000000-0000-0000-0000-00000000000e",
      "location_type": "door",
      "name": "Test Name 22",
      "up_id": "00000000-0000-0000-0000-000000000001",
      "extras": null,
      "device_ids": [
        "aabbcc000004"
      ],
      "state": {

        "lock": "unlocked",
        "dps": "open",
        "dps_connected": true,
        "emergency": {

          "software": "none",
          "hardware": "none"
        },
        "is_unavailable": false
      },
      "thumbnail": {

        "type": "none",
        "url": "",
        "door_thumbnail_last_update": 0
      },
      "last_activity": 1786743856
    },
    "meta": {

      "object_type": "location",
      "target_field": null,
      "all_field": true,
      "id": "00000000-0000-0000-0000-00000000000e",
      "source": ""
    }
  }
];

/* An answered doorbell call, recorded on the controller's official notification socket rather than the Access application's own. Both sockets carry the same
 * stream, so this window is here for the one shape that appears nowhere else in the corpus: the second payload the controller sends under the
 * access.remote_view.change name.
 *
 * That name carries two structurally unrelated payloads within a single call. The first reports the call's disposition and names the call it ended. The second,
 * below, is a record of the unlock the answer produced - who authenticated, through which reader, on which door. It stays on the raw packet rail deliberately
 * rather than being lifted into a typed unlock: the controller has already reported that same unlock as access.data.device.remote_unlock a fraction of a second
 * earlier in this very window, so classifying this one as a second unlock would report one physical door opening twice. The classifier tells the two payloads
 * apart by whether the call identifier is present, which is what the disposition shape is defined by.
 *
 * Captured from a live controller, 2026.
 */
export const accessEventPacketsOfficialSocketFixture: AccessEventPacket[] = [

  {

    "event": "access.remote_view.change",
    "receiver_id": "",
    "event_object_id": "00000000-0000-0000-0000-00000000005f",
    "save_to_history": false,
    "data": {

      "device_id": "aabbcc000001",
      "access_device_id": "aabbcc000002",
      "user_id": "00000000-0000-0000-0000-00000000000b",
      "user_type": "user",
      "user_status": "",
      "location_id": "00000000-0000-0000-0000-000000000006",
      "authentication_type": "CALL",
      "out": false,
      "reason_code": 0,
      "success": true,
      "capture_resource_id": "",
      "faces_capture_id": "",
      "timestamp": 1786828198,
      "source": "bell",
      "viewer_id": ""
    }
  }
];

/* A tamper capture window: a UA Ultra worked deliberately at the mount until it raised the alert the controller sends for it, so the notification arrives in the
 * company of the device updates that carry the configuration row it concerns. It is its own group because it is its own window on its own hardware, and because
 * every other group here documents exactly the event names its window produced.
 *
 * The alert names the hardware in its payload and carries no verdict of its own - what the device reports lives on the tamper_event row of its record - and its
 * envelope identifier is a per-notification value rather than the device it concerns.
 *
 * Captured from a live controller, 2026.
 */
export const accessEventPacketsTamperFixture: AccessEventPacket[] = [

  {

    "event": "access.tamper_resistant",
    "receiver_id": "",
    "event_object_id": "00000000-0000-0000-0000-000000000060",
    "save_to_history": true,
    "data": {

      "device": {

        "unique_id": "aabbcc000000",
        "name": "Test Name 6",
        "device_type": "UA-ULTRA",
        "mac": "AABBCC000000",
        "guid": "00000000-0000-0000-0000-000000000003",
        "firmware": "v1.7.4.0",
        "is_connected": true
      },
      "door_id": "00000000-0000-0000-0000-000000000002",
      "door_name": "Test Name 4",
      "host_device_mac": "AABBCC000011",
      "notify_user_ids": [
        "00000000-0000-0000-0000-00000000000b"
      ],
      "request_id": "00000000-0000-0000-0000-000000000061",
      "title": "Test Name 100"
    }
  }
];
