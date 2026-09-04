**unifi-access**

***

<SPAN ALIGN="CENTER" STYLE="text-align:center">
<DIV ALIGN="CENTER" STYLE="text-align:center">

[![unifi-access: UniFi Access API](https://raw.githubusercontent.com/hjdhjd/unifi-access/main/unifi-access.svg)](https://github.com/hjdhjd/unifi-access)

# UniFi Access API

[![Downloads](https://img.shields.io/npm/dt/unifi-access?color=%230559C9&logo=icloud&logoColor=%23FFFFFF&style=for-the-badge)](https://www.npmjs.com/package/unifi-access)
[![Version](https://img.shields.io/npm/v/unifi-access?color=%230559C9&label=UniFi%20Access%20API&logo=ubiquiti&logoColor=%23FFFFFF&style=for-the-badge)](https://www.npmjs.com/package/unifi-access)

## A complete UniFi Access API implementation.
</DIV>
</SPAN>

`unifi-access` is a TypeScript library for the Ubiquiti [UniFi Access](https://ui.com/door-access) door access platform, implementing both of the controller's API surfaces: the native interface the Access application itself speaks, and the published developer API as a complete typed reference.

The library is built around a single model: the controller's state is a reducer over a typed realtime notification stream, with a periodic re-bootstrap as a permanent failsafe. `AccessClient.connect()` returns a fully-ready client or throws a typed error, devices are live projections whose getters always reflect the current state, every failure is a typed `AccessError`, and every long-lived resource is an `AsyncDisposable` that `await using` tears down at scope exit.

A client connects with credentials, a token, or both. Credentials reach the native surface - the topology and the realtime firehose. A token reaches the official developer API at `client.official`, with a typed method for every documented endpoint, webhook payload types with signature verification, and door control, and its device and door listings seed the same state model. So the device projections answer in either mode, carrying what that mode's census established. With both, door commands route official-first and `client.capabilities` says what the connection established.

The package also installs `ufa`, a command-line client that is the library's reference consumer by construction: every command reaches the controller through the public API surface and nothing else.

## Why use this library for UniFi Access support?

In short, because I use it every day to support a [Homebridge](https://homebridge.io) plugin named [homebridge-unifi-access](https://www.npmjs.com/package/homebridge-unifi-access) that I maintain. I package the core API library separately from the plugin so that other open source projects can take advantage of the work that has been done here to understand and decode the UniFi Access API.

The native UniFi Access API is largely undocumented, and implementing a library like this one is the result of many hours of trial and error as well as community support.

### <A NAME="access-contribute"></A>How you can contribute and make this library even better

I welcome inputs and perspective, particularly around hardware I cannot test against directly. Gate hubs are the notable case: their behavior is implemented from field reports rather than from captures, and it is marked as such wherever it is asserted.

## Client

| Name | Description |
| ------ | ------ |
| [AccessClient](classes/AccessClient.md) | The UniFi Access client. Construct it through [AccessClient.connect](classes/AccessClient.md#connect). |
| [AccessCapabilities](interfaces/AccessCapabilities.md) | What a client can do, as established at connect. |
| [AccessClientEvents](interfaces/AccessClientEvents.md) | The events [AccessClient](classes/AccessClient.md) publishes. |
| [ConnectionEvents](interfaces/ConnectionEvents.md) | The events [ConnectionMonitor](interfaces/ConnectionMonitor.md) publishes on its three-rail surface. |
| [ConnectionMonitor](interfaces/ConnectionMonitor.md) | The connection coordinator. Constructed by the client; consumers read it as `client.connection`. |
| [ConnectionTransition](interfaces/ConnectionTransition.md) | One edge of the connection state machine, carried on the `stateChanged` rail and yielded by [ConnectionMonitor.observe](interfaces/ConnectionMonitor.md#observe). `reason` is present when a typed fault - a stall, a failed reachability probe - is what drove the edge. |
| [ConnectOptionsBase](interfaces/ConnectOptionsBase.md) | The options common to every way of connecting: the controller address, and the injected dependencies that each have a default. |
| [AccessApiMode](type-aliases/AccessApiMode.md) | Which identities a client holds, and therefore which of the controller's APIs it can reach. |
| [AccessApiOverride](type-aliases/AccessApiOverride.md) | Which API a routed command should prefer. |
| [ConnectIdentity](type-aliases/ConnectIdentity.md) | The identities a client can connect with. At least one is required, and the union is what makes "no identity at all" impossible to write. |
| [ConnectionState](type-aliases/ConnectionState.md) | The connection's observable state. `healthy` is steady operation; `degraded` means a fault was seen and reachability is being probed; `reconnecting` means the controller answered and the monitor is re-bootstrapping and relaunching the notification stream; `lost` means the controller is unreachable and recovery is polling for its return; `throttled` means the transport's breaker is open and holding requests back. The throttle verdict is read live from the transport and takes precedence only while nothing else is wrong. |
| [ConnectOptions](type-aliases/ConnectOptions.md) | Options for [AccessClient.connect](classes/AccessClient.md#connect): the controller address and injected dependencies, plus at least one identity to connect with. |

## Devices

| Name | Description |
| ------ | ------ |
| [AccessDevice](interfaces/AccessDevice.md) | A device on the controller, as a live projection with the write-through command surface every modeled device supports. |
| [AccessDeviceRegistry](interfaces/AccessDeviceRegistry.md) | The projection factory the client composes. It turns identities into live handles over the current store snapshot: every modeled device as an [AccessDevice](interfaces/AccessDevice.md), the hub-capable ones as command-bearing [AccessHub](interfaces/AccessHub.md) handles, and each door-serving port of a multi-port Enterprise Access Hub as a handle of its own. |
| [AccessHub](interfaces/AccessHub.md) | A hub-capable device, as a live projection carrying the commands that act on the door it drives. |
| [AccessLockRule](type-aliases/AccessLockRule.md) | The rule that governs how a door's lock behaves until something changes it. |

## State

| Name | Description |
| ------ | ------ |
| [StateStore](interfaces/StateStore.md) | The canonical state holder. See the module documentation for the model. The composition root constructs it and consumers read it; [createStateStore](functions/createStateStore.md) is the one documented exception, the factory a test harness uses to drive the real engine standalone. |
| [StateStoreOptions](interfaces/StateStoreOptions.md) | Construction options for [StateStore](interfaces/StateStore.md). |
| [createStateStore](functions/createStateStore.md) | Construct a [StateStore](interfaces/StateStore.md) directly - the single documented exception to the package's export law, which otherwise keeps the store off the public surface so a consumer has exactly one composition path. This factory exists for the test harnesses that need the real reducer and observer engine standalone: a consumer driving the genuine store never has to hand-mirror its dispatch, dedup, and refresh semantics in a double. |
| [isEnterpriseHubRecord](functions/isEnterpriseHubRecord.md) | Whether a device record is an Enterprise Access Hub the building hosts directly - the multi-port hardware [selectAccessPoints](functions/selectAccessPoints.md) expands into one access point per door-serving port. |
| [isHub](functions/isHub.md) | Whether a device acts as a hub - hardware that drives a door's lock, as opposed to a reader that only presents credentials to one. |
| [isReader](functions/isReader.md) | Whether a device acts as a reader - hardware that presents credentials to a door, as opposed to a hub that drives its lock. |
| [selectAccessPoints](functions/selectAccessPoints.md) | The logical access points: one entry per door-serving port of every Enterprise Access Hub, presented as a device in its own right so that a consumer sees one piece of hardware per door rather than one hub standing in for eight of them. |
| [selectController](functions/selectController.md) | The controller's own information document, or `null` before one has been fetched. Read through a selector rather than off the state directly so that every consumer of the controller record - including the client's own convenience getter - reaches it the one way. |
| [selectControllerName](functions/selectControllerName.md) | The controller's display name, or `null` before its information document has been fetched. This is the host's own hostname - the name an administrator gave the console, and the one that matches what the controller's interface shows - rather than the hardware shortname beside it, which names the model. |
| [selectControllerUptime](functions/selectControllerUptime.md) | The controller host's uptime in seconds, or `null` before its information document has been fetched. |
| [selectDevicesByType](functions/selectDevicesByType.md) | Every device grouped by its `device_type`. The type is an open string the controller chooses, so the map holds exactly the types the hardware in front of you reports, in the order the devices map holds them - a type this library has never heard of gets its own bucket rather than being dropped. |
| [selectDoorDevices](functions/selectDoorDevices.md) | The hardware attached to each door, keyed by door identity. Every door in the state is present, so a door with no hardware maps to an empty array rather than being absent - a consumer iterating doors never has to distinguish "no hardware" from "unknown door". |
| [selectDoorStates](functions/selectDoorStates.md) | The live state of every door the reducer holds one for, keyed by door identity. A door with no derivable state is absent rather than present-and-empty, because there is no such thing as a default door state: the entry means "this is what the door last said, or what its hardware flags imply", and its absence means neither source has produced one. The reducer seeds an entry for every door whose topology record carries enough hardware flags to derive one, so a freshly connected client already sees those doors before any of them reports. |
| [selectHubs](functions/selectHubs.md) | Every device that acts as a hub, in the order the devices map holds them. A device qualifies by carrying the controller's own `is_hub` capability, so a hub-capable device type this library has never seen still classifies correctly. |

## Events

| Name | Description |
| ------ | ------ |
| [StreamOptions](interfaces/StreamOptions.md) | Options accepted by the event-bus `stream` rail. Carries the abort signal that terminates the iteration; further keys are reserved for a future backpressure policy. The default behavior is unbounded, matching the event-subscription rule (a subscriber receives every emission until it aborts or stops iterating). |
| [AccessTypedEvent](type-aliases/AccessTypedEvent.md) | The discriminated union of every notification the library models, produced by the classifier. It splits into two categories by relationship to state. |
| [AccessWireEvent](type-aliases/AccessWireEvent.md) | The members of [AccessTypedEvent](type-aliases/AccessTypedEvent.md) that a notification packet can actually produce - the rule being that a wire event is whatever the classifier can return. The classifier lifts wire packets and nothing else, while the synthetic members are the ones the client dispatches directly from a fetched document, so a consumer reading the notification stream can hold this narrower type honestly rather than carrying arms the wire will never hand it. Every member here is an [AccessTypedEvent](type-aliases/AccessTypedEvent.md), so anything that accepts the wider union accepts these unchanged. |
| [isAccessEventPacket](functions/isAccessEventPacket.md) | Whether a decoded value is shaped like an [AccessEventPacket](type-aliases/AccessEventPacket.md). This is the decode boundary the notification stream needs: `JSON.parse` hands back an unchecked value, and asserting that value into the packet type would let any valid-JSON frame through, so a frame carrying no `event_object_id` would reach consumers with an undefined identifier typed as a string and be published under it. |

## Transport

| Interface | Description |
| ------ | ------ |
| [AccessWebSocket](interfaces/AccessWebSocket.md) | The minimal *receive-direction* WebSocket surface the realtime events stream consumes - deliberately a small subset of the WHATWG/undici `WebSocket`, so the dependency is exactly what the stream needs and nothing more. undici's `WebSocket` satisfies this structurally, so the default factory assigns to it without a cast. |
| [AccessWebSocketCloseEvent](interfaces/AccessWebSocketCloseEvent.md) | The close event delivered to a `close` listener. Mirrors the WebSocket close frame's code and reason. |
| [AccessWebSocketErrorEvent](interfaces/AccessWebSocketErrorEvent.md) | The error event delivered to an `error` listener. `error` carries the underlying cause when the implementation provides one (undici does). |
| [AccessWebSocketListenerOptions](interfaces/AccessWebSocketListenerOptions.md) | The listener-registration options the stream uses - a subset of the standard `addEventListener` options. `signal` is how one `AbortController` detaches every listener at once, which is the stream's whole teardown mechanism. |
| [AccessWebSocketMessageEvent](interfaces/AccessWebSocketMessageEvent.md) | The message event delivered to a `message` listener. The notification protocol is JSON text, so a frame's `data` normally arrives as a string; we accept any shape and normalize it to text before decoding. |

## Protocol

| Name | Description |
| ------ | ------ |
| [AccessActorType](type-aliases/AccessActorType.md) | Who or what an action is attributed to. |
| [ACCESS\_AUTHENTICATION\_TYPES](variables/ACCESS_AUTHENTICATION_TYPES.md) | What each of an unlock's authentication types means, in words fit to show a person. |
| [ACCESS\_DOORBELL\_REASON\_CODES](variables/ACCESS_DOORBELL_REASON_CODES.md) | What each of a doorbell call's reason codes means, in words fit to show a person. |
| [isMacAddress](functions/isMacAddress.md) | Whether a value is a hardware address in either shape the controller produces. |
| [normalizeActorType](functions/normalizeActorType.md) | Fold an actor type into the library's single spelling of it. |
| [normalizeMacAddress](functions/normalizeMacAddress.md) | Fold a hardware address into the library's single spelling of it: uppercase, with no separators. |

## Official

| Name | Description |
| ------ | ------ |
| [AccessOfficialAccessMethodFace](interfaces/AccessOfficialAccessMethodFace.md) | Face unlock's settings. The two tuning members apply only while the method itself is enabled, and a reader reports only the ones it supports. |
| [AccessOfficialAccessMethodFaceUpdate](interfaces/AccessOfficialAccessMethodFaceUpdate.md) | Set face unlock's settings. |
| [AccessOfficialAccessMethodPinCode](interfaces/AccessOfficialAccessMethodPinCode.md) | The PIN keypad's settings. Shuffling the keypad layout applies only while the method itself is enabled. |
| [AccessOfficialAccessMethodPinCodeUpdate](interfaces/AccessOfficialAccessMethodPinCodeUpdate.md) | Set the PIN keypad's settings. Shuffling applies only while the method is enabled. |
| [AccessOfficialAccessMethods](interfaces/AccessOfficialAccessMethods.md) | The access methods a device offers, keyed by method. |
| [AccessOfficialAccessMethodsUpdate](interfaces/AccessOfficialAccessMethodsUpdate.md) | The access methods to change, keyed by method. Naming a method the device's hardware class does not offer has no effect. |
| [AccessOfficialAccessMethodToggle](interfaces/AccessOfficialAccessMethodToggle.md) | An access method that is simply on or off. |
| [AccessOfficialAccessPolicy](interfaces/AccessOfficialAccessPolicy.md) | An access policy: a named grant joining a set of door resources to a schedule. |
| [AccessOfficialAccessPolicyCreate](interfaces/AccessOfficialAccessPolicyCreate.md) | Create an access policy. |
| [AccessOfficialAccessPolicyResource](interfaces/AccessOfficialAccessPolicyResource.md) | A door or door group an access policy grants entry to. |
| [AccessOfficialAccessPolicyResourceRef](interfaces/AccessOfficialAccessPolicyResourceRef.md) | The resource reference a policy request names. Closed over the documented pair: a caller composes a request from the documented set, so a misspelling is a compile error rather than a request the controller silently refuses. |
| [AccessOfficialAccessPolicyUpdate](interfaces/AccessOfficialAccessPolicyUpdate.md) | Update an access policy. Every member is optional - the endpoint is a partial update, and an omitted member is left as it stands. |
| [AccessOfficialCallOptions](interfaces/AccessOfficialCallOptions.md) | Per-call options accepted by every official domain method, always as the method's last parameter. |
| [AccessOfficialCertificateUpload](interfaces/AccessOfficialCertificateUpload.md) | The certificate and private key to install on the official API's TLS listener. |
| [AccessOfficialDevice](interfaces/AccessOfficialDevice.md) | An adopted device. |
| [AccessOfficialDeviceListOptions](interfaces/AccessOfficialDeviceListOptions.md) | List devices. `refresh` asks the controller for real-time device state rather than its cache, which is slower. |
| [AccessOfficialDeviceSettings](interfaces/AccessOfficialDeviceSettings.md) | A device's access-method settings, and the device they belong to. |
| [AccessOfficialDeviceSettingsUpdate](interfaces/AccessOfficialDeviceSettingsUpdate.md) | Update a device's access-method settings. |
| [AccessOfficialDoor](interfaces/AccessOfficialDoor.md) | A door. |
| [AccessOfficialDoorbellTriggerOptions](interfaces/AccessOfficialDoorbellTriggerOptions.md) | Trigger a doorbell. `cancel` stops a call that is still ringing rather than starting one. |
| [AccessOfficialDoorGroup](interfaces/AccessOfficialDoorGroup.md) | A door group: a named set of doors an access policy can grant against as a unit. |
| [AccessOfficialDoorGroupCreate](interfaces/AccessOfficialDoorGroupCreate.md) | Create a door group. The name must be unique across the controller, and the resources are door identifiers from the topology. |
| [AccessOfficialDoorGroupResource](interfaces/AccessOfficialDoorGroupResource.md) | A door within a door group. The group's detail read names each door; its list and write reads report only the identifier and kind. |
| [AccessOfficialDoorGroupTopology](interfaces/AccessOfficialDoorGroupTopology.md) | A door group as the topology describes it, with the floors and doors beneath it. |
| [AccessOfficialDoorGroupUpdate](interfaces/AccessOfficialDoorGroupUpdate.md) | Update a door group. Every member is optional - the endpoint is a partial update. An empty `resources` array empties the group. |
| [AccessOfficialDoorUnlockActor](interfaces/AccessOfficialDoorUnlockActor.md) | Who to attribute an unlock to. Both members are required together: the reference documents each as required whenever the other is supplied, so pairing them in one object makes that structural rather than a rule a caller has to remember. |
| [AccessOfficialDoorUnlockOptions](interfaces/AccessOfficialDoorUnlockOptions.md) | Unlock a door. |
| [AccessOfficialEmergencyStatus](interfaces/AccessOfficialEmergencyStatus.md) | Which site-wide emergency modes are in force. |
| [AccessOfficialFileUpload](interfaces/AccessOfficialFileUpload.md) | A file a caller hands to a multipart endpoint: its bytes and the name to announce it under. |
| [AccessOfficialFormPart](interfaces/AccessOfficialFormPart.md) | One part of a multipart upload: the bytes, the form field the endpoint reads them from, and the filename the part is announced under. |
| [AccessOfficialHoliday](interfaces/AccessOfficialHoliday.md) | One holiday within a holiday group. |
| [AccessOfficialHolidayCreate](interfaces/AccessOfficialHolidayCreate.md) | One holiday as a write request names it. An entry carrying no `id` is added; an entry carrying one updates the holiday it names. |
| [AccessOfficialHolidayGroup](interfaces/AccessOfficialHolidayGroup.md) | A holiday group in full, as the detail and write endpoints return it. |
| [AccessOfficialHolidayGroupCreate](interfaces/AccessOfficialHolidayGroupCreate.md) | Create a holiday group. |
| [AccessOfficialHolidayGroupSummary](interfaces/AccessOfficialHolidayGroupSummary.md) | A holiday group as the list endpoint summarizes it: the holiday count in place of the holidays themselves. |
| [AccessOfficialHolidayGroupUpdate](interfaces/AccessOfficialHolidayGroupUpdate.md) | Update a holiday group. `holidays` is omitted when the set is not being changed. |
| [AccessOfficialIdentityAssignment](interfaces/AccessOfficialIdentityAssignment.md) | Assign Identity resources of one type. |
| [AccessOfficialIdentityInvitation](interfaces/AccessOfficialIdentityInvitation.md) | One UniFi Identity invitation. Supplying `email` updates the user's recorded address as the invitation goes out. |
| [AccessOfficialIdentityInvitationFailure](interfaces/AccessOfficialIdentityInvitationFailure.md) | One invitation that could not be sent. The controller reports the request as a success even when individual invitations fail, so this array is where a partial failure is visible - an empty one means every invitation went out. |
| [AccessOfficialIdentityResource](interfaces/AccessOfficialIdentityResource.md) | A UniFi Identity resource - an EV station, a VPN, a Wi-Fi network, or a camera. |
| [AccessOfficialIdentityResourceOptions](interfaces/AccessOfficialIdentityResourceOptions.md) | Read the Identity resources available to assign. |
| [AccessOfficialLicensePlate](interfaces/AccessOfficialLicensePlate.md) | A license plate registered as a credential. |
| [AccessOfficialLockRule](interfaces/AccessOfficialLockRule.md) | The temporary locking rule in force on a door, and when it ends. |
| [AccessOfficialNfcCard](interfaces/AccessOfficialNfcCard.md) | An NFC card known to the controller. |
| [AccessOfficialNfcCardEnroll](interfaces/AccessOfficialNfcCardEnroll.md) | Open an NFC enrollment session on a reader. |
| [AccessOfficialNfcCardImportResult](interfaces/AccessOfficialNfcCardImportResult.md) | The outcome of one row of an NFC card import. |
| [AccessOfficialNfcCardRef](interfaces/AccessOfficialNfcCardRef.md) | An NFC card as a holder's own record names it - the handle and the card type, rather than the full card record. |
| [AccessOfficialNfcCardUpdate](interfaces/AccessOfficialNfcCardUpdate.md) | Update an NFC card's alias. |
| [AccessOfficialNfcCardUser](interfaces/AccessOfficialNfcCardUser.md) | Whoever an NFC card is assigned to, as the card record names them. |
| [AccessOfficialNfcEnrollmentSession](interfaces/AccessOfficialNfcEnrollmentSession.md) | The reader session opened to enroll an NFC card. |
| [AccessOfficialNfcEnrollmentStatus](interfaces/AccessOfficialNfcEnrollmentStatus.md) | What a reader has read so far in an enrollment session. The token is what the assignment endpoints take once a card has been presented. |
| [AccessOfficialPageOptions](interfaces/AccessOfficialPageOptions.md) | The pagination members every paginated official endpoint accepts, in the library's own camelCase. They are renamed to the wire's own `page_num` and `page_size` spelling on the way out, in one place rather than at each of the paginated call sites. |
| [AccessOfficialPinCodeRef](interfaces/AccessOfficialPinCodeRef.md) | The PIN code assigned to a holder, as their record names it. The code itself is never echoed - only the token that stands for it. |
| [AccessOfficialRequestOptions](interfaces/AccessOfficialRequestOptions.md) | Per-request options for an official request: everything the transport accepts, plus the two encodings this layer owns. |
| [AccessOfficialResourceTopology](interfaces/AccessOfficialResourceTopology.md) | A floor within the topology, and the doors on it. |
| [AccessOfficialSchedule](interfaces/AccessOfficialSchedule.md) | A schedule: the weekly access pattern a policy grants on, plus the holiday handling that overrides it. |
| [AccessOfficialScheduleCreate](interfaces/AccessOfficialScheduleCreate.md) | Create a schedule. The name must be unique across the controller. |
| [AccessOfficialScheduleUpdate](interfaces/AccessOfficialScheduleUpdate.md) | Update a schedule. Every member is optional - the endpoint is a partial update. |
| [AccessOfficialScheduleWindow](interfaces/AccessOfficialScheduleWindow.md) | One access window within a day: the wire's `HH:MM:SS` strings, inclusive of the start and exclusive of nothing the reference documents. |
| [AccessOfficialSystemLogActor](interfaces/AccessOfficialSystemLogActor.md) | Who a log entry attributes its event to. |
| [AccessOfficialSystemLogAuthentication](interfaces/AccessOfficialSystemLogAuthentication.md) | How the credential behind a log entry was presented. Null on an entry that involved no authentication at all, such as a device reboot. |
| [AccessOfficialSystemLogEvent](interfaces/AccessOfficialSystemLogEvent.md) | What happened, as a log entry describes it. |
| [AccessOfficialSystemLogExportOptions](interfaces/AccessOfficialSystemLogExportOptions.md) | Export the system log as CSV. The window between `since` and `until` cannot exceed one month, and `timezone` is an IANA zone name such as `America/New_York`. |
| [AccessOfficialSystemLogFetchOptions](interfaces/AccessOfficialSystemLogFetchOptions.md) | Query the system log. `since` and `until` are unix epoch seconds. |
| [AccessOfficialSystemLogHit](interfaces/AccessOfficialSystemLogHit.md) | One log entry, in the search-result envelope the controller wraps each in. |
| [AccessOfficialSystemLogHits](interfaces/AccessOfficialSystemLogHits.md) | A page of log entries. |
| [AccessOfficialSystemLogResource](interfaces/AccessOfficialSystemLogResource.md) | A media resource a log entry points at. |
| [AccessOfficialSystemLogSource](interfaces/AccessOfficialSystemLogSource.md) | The body of one log entry. |
| [AccessOfficialSystemLogTarget](interfaces/AccessOfficialSystemLogTarget.md) | One thing a log entry concerns - a device, a door, a floor, a building, or a piece of the request's own context. |
| [AccessOfficialTopologyResource](interfaces/AccessOfficialTopologyResource.md) | A door within the topology, as the floor above it lists it. |
| [AccessOfficialTouchPass](interfaces/AccessOfficialTouchPass.md) | A Touch Pass: a credential provisioned onto a phone or watch rather than carried as a card. |
| [AccessOfficialTouchPassBatchAssign](interfaces/AccessOfficialTouchPassBatchAssign.md) | Assign Touch Passes to several users at once. `emails` is keyed by user identifier. |
| [AccessOfficialTouchPassBundle](interfaces/AccessOfficialTouchPassBundle.md) | One device a Touch Pass has been provisioned onto. |
| [AccessOfficialTouchPassBundleUpdate](interfaces/AccessOfficialTouchPassBundleUpdate.md) | Detach one device from a Touch Pass. |
| [AccessOfficialTouchPassListOptions](interfaces/AccessOfficialTouchPassListOptions.md) | List Touch Passes, optionally narrowed to one status. |
| [AccessOfficialTouchPassUpdate](interfaces/AccessOfficialTouchPassUpdate.md) | Update a Touch Pass: rename it, change its status, or unbundle devices from it. |
| [AccessOfficialUser](interfaces/AccessOfficialUser.md) | A user account on the controller. |
| [AccessOfficialUserAccessPolicyOptions](interfaces/AccessOfficialUserAccessPolicyOptions.md) | Read the policies assigned to a user. With `only_user_policies` set, the policies inherited from the user's groups are left out. |
| [AccessOfficialUserAvatar](interfaces/AccessOfficialUserAvatar.md) | Where a user's uploaded profile picture now lives. |
| [AccessOfficialUserCreate](interfaces/AccessOfficialUserCreate.md) | Register a user. `user_email` requires UniFi Access 1.22.16 or later. |
| [AccessOfficialUserFetchOptions](interfaces/AccessOfficialUserFetchOptions.md) | Read one user, optionally expanded. |
| [AccessOfficialUserGroup](interfaces/AccessOfficialUserGroup.md) | A user group. `up_id` names the parent group and `up_ids` the whole ancestry, so a caller can place a group in the hierarchy without walking it. |
| [AccessOfficialUserGroupCreate](interfaces/AccessOfficialUserGroupCreate.md) | Create a user group. `up_id` places it under an existing group. |
| [AccessOfficialUserGroupMember](interfaces/AccessOfficialUserGroupMember.md) | A user as a group's membership list names them - the account fields, without the credentials or policies a full user record carries. |
| [AccessOfficialUserGroupUpdate](interfaces/AccessOfficialUserGroupUpdate.md) | Update a user group. Every member is optional - the endpoint is a partial update. |
| [AccessOfficialUserListOptions](interfaces/AccessOfficialUserListOptions.md) | List users: a page, optionally expanded. |
| [AccessOfficialUserNfcCardAssign](interfaces/AccessOfficialUserNfcCardAssign.md) | Assign an NFC card to a user. `force_add` takes the card from whoever currently holds it. |
| [AccessOfficialUserSearchOptions](interfaces/AccessOfficialUserSearchOptions.md) | Search users. `status` and `userId` are repeatable - each entry is sent under its own key, which is how the endpoint takes more than one. |
| [AccessOfficialUserSearchResult](interfaces/AccessOfficialUserSearchResult.md) | A user as the search endpoint returns them: the group-member fields plus the two credential members search adds. |
| [AccessOfficialUserUpdate](interfaces/AccessOfficialUserUpdate.md) | Update a user. Every member is optional - the endpoint is a partial update, and an omitted member is left as it stands. |
| [AccessOfficialVisitor](interfaces/AccessOfficialVisitor.md) | A visitor: a guest granted access between a start and an end time. |
| [AccessOfficialVisitorCreate](interfaces/AccessOfficialVisitorCreate.md) | Invite a visitor. `week_schedule` makes the visit recurring; omitting it makes it a one-time visit between the start and end times. |
| [AccessOfficialVisitorDeleteOptions](interfaces/AccessOfficialVisitorDeleteOptions.md) | Delete a visitor. Without `is_force` the visitor is moved to the cancelled status; with it, the record is removed outright. |
| [AccessOfficialVisitorListOptions](interfaces/AccessOfficialVisitorListOptions.md) | List visitors. A `keyword` prefix-matches the first and last name, and disables the status filter while it is present. |
| [AccessOfficialVisitorNfcCardAssign](interfaces/AccessOfficialVisitorNfcCardAssign.md) | Assign an NFC card to a visitor. `force_add` takes the card from whoever currently holds it. |
| [AccessOfficialVisitorResource](interfaces/AccessOfficialVisitorResource.md) | A door or door group a visitor may enter, as their record names it. |
| [AccessOfficialVisitorResourceRef](interfaces/AccessOfficialVisitorResourceRef.md) | A door or door group a visitor request grants. Closed over the documented pair: a caller composes a request from the documented set, so a misspelling is a compile error rather than a request the controller silently refuses. |
| [AccessOfficialVisitorSchedule](interfaces/AccessOfficialVisitorSchedule.md) | The recurring visit schedule attached to a visitor. |
| [AccessOfficialVisitorUpdate](interfaces/AccessOfficialVisitorUpdate.md) | Update a visitor. Every member is optional - the endpoint is a partial update, and an omitted member is left as it stands. A visitor's status cannot be changed through this endpoint. |
| [AccessOfficialWebhookEndpoint](interfaces/AccessOfficialWebhookEndpoint.md) | A registered webhook endpoint. |
| [AccessOfficialWebhookEndpointWrite](interfaces/AccessOfficialWebhookEndpointWrite.md) | Register or replace a webhook endpoint. The update endpoint takes the same full record rather than a partial one, so this shape serves both. |
| [AccessOfficialWeekSchedule](interfaces/AccessOfficialWeekSchedule.md) | The weekly access pattern, keyed by the lowercase English day names the wire spells. |
| [AccessWebhookActor](interfaces/AccessWebhookActor.md) | Who an action is attributed to, when the controller attributes it to anyone. |
| [AccessWebhookDelivery](interfaces/AccessWebhookDelivery.md) | The body of a webhook delivery: the event's name, the identifier the controller minted for this delivery, and the payload. |
| [AccessWebhookDevice](interfaces/AccessWebhookDevice.md) | The device a delivery concerns, as the webhook channel describes it. |
| [AccessWebhookDoorbellCompletedObject](interfaces/AccessWebhookDoorbellCompletedObject.md) | What a doorbell-completed delivery reports: which call ended, and why. |
| [AccessWebhookDoorbellIncomingObject](interfaces/AccessWebhookDoorbellIncomingObject.md) | What a doorbell-ring delivery reports: the identifier of the call that is beginning. |
| [AccessWebhookDoorbellRenObject](interfaces/AccessWebhookDoorbellRenObject.md) | What a request-to-enter delivery reports. The shape is the completed-call one, on a delivery that names no device: a request-to-enter button is wired to the hub rather than being a device the controller adopted. |
| [AccessWebhookDoorUnlockObject](interfaces/AccessWebhookDoorUnlockObject.md) | What an unlock delivery reports: how the door was opened, whether it opened, and on whose behalf. |
| [AccessWebhookDpsStatusObject](interfaces/AccessWebhookDpsStatusObject.md) | What a door-position delivery reports: which way the door moved. |
| [AccessWebhookEmergencyStatusObject](interfaces/AccessWebhookEmergencyStatusObject.md) | What an emergency-status delivery reports: which emergency mode changed, whether it is now in force, and whether it applies to the whole site. |
| [AccessWebhookLocation](interfaces/AccessWebhookLocation.md) | The door, floor, or building a delivery concerns, as the webhook channel describes it. |
| [AccessWebhookSignature](interfaces/AccessWebhookSignature.md) | What a verified signature established: the moment the controller signed the delivery, as the unix timestamp in seconds the header's `t` member carried and the MAC covered. A receiver compares it against its own clock to apply whatever freshness window its policy calls for. |
| [AccessOfficialAccessMethodValue](type-aliases/AccessOfficialAccessMethodValue.md) | Whether an access method is switched on. The wire spells these `"yes"` and `"no"` rather than as booleans, in both directions - the write takes the same pair the read returns - and this is the one vocabulary here carried closed: both values have been observed live, and the reference's own field table claiming `"true"`/`"false"` is contradicted by its own sample on the same page and by the wire. |
| [AccessOfficialDoorEntryMethod](type-aliases/AccessOfficialDoorEntryMethod.md) | Which direction a driveway gate is being entered, for a double-driveway gate that reads its two approaches separately. `in` is the approach toward the property and `out` is the approach away from it. |
| [AccessOfficialEmergencyState](type-aliases/AccessOfficialEmergencyState.md) | Which site-wide emergency mode to put in force. `normal` restores both flags to off. |
| [AccessOfficialIdentityResourceMap](type-aliases/AccessOfficialIdentityResourceMap.md) | Identity resources grouped by resource type. |
| [AccessOfficialIdentityResourceType](type-aliases/AccessOfficialIdentityResourceType.md) | The resource types the availability query accepts. Closed over the documented query vocabulary; leaving it out returns every type, `camera` included. |
| [AccessOfficialLockRuleSet](type-aliases/AccessOfficialLockRuleSet.md) | The temporary locking rule to put on a door. |
| [AccessOfficialQuery](type-aliases/AccessOfficialQuery.md) | The query members an official endpoint accepts, as the caller spells them. A member's value is dropped when it is `undefined`, so a caller composes one record with every parameter the endpoint documents and lets the absent ones fall away rather than assembling a different record per combination. |
| [AccessOfficialSystemLogTopic](type-aliases/AccessOfficialSystemLogTopic.md) | The activity categories a log query can ask for. |
| [AccessOfficialUserCreated](type-aliases/AccessOfficialUserCreated.md) | What the registration endpoint echoes back. |
| [AccessOfficialUserExpand](type-aliases/AccessOfficialUserExpand.md) | The expansions a user read accepts. The reference's field table labels this a boolean flag, but its own sample sends `expand[]=access_policy` and the visitor sibling documents the same parameter as a string vocabulary - a boolean would serialize as `expand[]=true` and silently return an unexpanded record. |
| [AccessOfficialVisitorExpand](type-aliases/AccessOfficialVisitorExpand.md) | The expansions a visitor list accepts. Requires UniFi Access 1.22.16 or later. |
| [AccessOfficialWebhookEventName](type-aliases/AccessOfficialWebhookEventName.md) | The name of an event an endpoint can be registered for. |
| [AccessWebhookEvent](type-aliases/AccessWebhookEvent.md) | Every webhook event the controller can be registered for, as a discriminated union on `event`. |
| [AccessWebhookUnmodeledObject](type-aliases/AccessWebhookUnmodeledObject.md) | The payload of an event the reference names in its webhook vocabulary without publishing a sample of it, and which no capture in hand has exercised. |
| [isAccessWebhookDelivery](functions/isAccessWebhookDelivery.md) | Whether a decoded value is shaped like an [AccessWebhookEvent](type-aliases/AccessWebhookEvent.md). This is the decode boundary a receiver needs: a delivery arrives as untrusted JSON on the receiver's own HTTP surface, and asserting the parsed value into the delivery union would let any valid-JSON body through to a `switch` on `event`. |
| [verifyWebhookSignature](functions/verifyWebhookSignature.md) | Establish that a webhook delivery really came from the controller that holds this endpoint's secret, and answer with what its signature established. |

## Errors

| Name | Description |
| ------ | ------ |
| [AccessAbortedError](classes/AccessAbortedError.md) | The caller's `AbortSignal` fired. The operation was cancelled by the consumer, not by the library's own deadline. Recoverable in the sense that the caller chose to stop - re-issuing the operation with a fresh signal is valid. |
| [AccessAuthError](classes/AccessAuthError.md) | Authentication failed: invalid credentials, an expired session that could not be renewed, a CSRF-token rotation that did not complete, or an API token the controller refused. Fatal because retrying with the same identity reproduces the failure. [AccessAuthError.identity](classes/AccessAuthError.md#identity) names which identity was the refused one, so a caller reporting the failure can point at the right one. |
| [AccessAuthorizationError](classes/AccessAuthorizationError.md) | The identity authenticated but lacks the privilege the operation requires (typically a `403`; Access reserves many operations for administrator accounts). Fatal because the same identity will keep being refused. [AccessAuthorizationError.identity](classes/AccessAuthorizationError.md#identity) names which one fell short, so a caller reporting the failure can point at the remedy that applies. |
| [AccessBootstrapError](classes/AccessBootstrapError.md) | The bootstrap sequence failed while fetching or parsing the controller bootstrap document. `stage` marks which - `"fetch"` when the bootstrap endpoint returns a non-2xx status or the transport fails reaching it, `"parse"` when the body cannot be decoded - so the caller can report the precise point of failure rather than a generic "connect failed." A login or reachability failure is not wrapped here; it propagates as its own typed fatal. |
| [AccessCapabilityError](classes/AccessCapabilityError.md) | A requested operation has no path this client can carry it on. Fatal because it describes what this client is rather than what the controller did: the same call will fail the same way for as long as the client lives, and a fresh connect with different options is what changes the answer. |
| [AccessError](classes/AccessError.md) | The error model in one sentence: every failure the library raises is a subclass of [AccessError](classes/AccessError.md), and the *first* level of the hierarchy answers the only question a caller universally needs answered - should I retry, or should I propagate? |
| [AccessNetworkError](classes/AccessNetworkError.md) | A connect, DNS, TLS, or socket-level failure reaching the controller. The originating Node `ErrnoException` is preserved on the `cause` chain (the shape undici raises as `TypeError("fetch failed", { cause: errnoError })`); `code` lifts the errno string out for convenient branching. |
| [AccessOfficialApiError](classes/AccessOfficialApiError.md) | The official API refused a request. Its result envelope carries a `code` on every response, and a code other than success is the controller declining in its own vocabulary rather than through an HTTP status - the status on such a response is a 2xx, so nothing below this layer can classify it. Fatal because the refusal describes the request rather than the moment: the same call will be refused the same way. |
| [AccessProtocolError](classes/AccessProtocolError.md) | A wire- or response-level violation the library cannot make sense of: an event packet that does not match the documented frame structure, a WebSocket message that breaks the spec the library decodes against, an HTTP response body that fails to parse, or a response missing data the operation requires. Fatal because the same bytes will not decode or validate differently on retry - the defect is in the payload, not in reaching it. |
| [AccessRequestError](classes/AccessRequestError.md) | The controller returned an error status the library does not classify more specifically (a 4xx other than 401/403, or any 5xx). The status, body, and headers are preserved so the caller can inspect the controller's own explanation. |
| [AccessStallError](classes/AccessStallError.md) | The realtime events channel produced no data for longer than its heartbeat watchdog window - silence beyond `ACCESS_EVENTS_HEARTBEAT_TIMEOUT`, which the controller's own heartbeat cadence should have filled several times over. The underlying channel is presumed dead. As a `RecoverableError`, the error type itself is the signal to recover: the events stream's subscriber (the `ConnectionMonitor`) re-bootstraps and relaunches rather than leaving a consumer reading state that silently stopped updating. |
| [AccessThrottledError](classes/AccessThrottledError.md) | We are inside the throttle cooldown window. The library has seen enough consecutive failures to back off from the controller, and this request was rejected locally rather than sent. Retry once the cooldown elapses. |
| [AccessTimeoutError](classes/AccessTimeoutError.md) | Our own request deadline elapsed before the controller responded. Distinct from [AccessAbortedError](classes/AccessAbortedError.md): this fires when the library's internal `AbortSignal.timeout()` wins the race, whereas an aborted error fires when the caller's signal wins. The transport tells the two apart by checking whether the caller's own `AbortSignal` is already aborted: if it is, the cancellation came from the caller; if not, the library's timeout won. |
| [FatalError](classes/FatalError.md) | Abstract base for failures the caller should propagate. Retrying the identical call will reproduce the identical failure, so the correct response is to surface it. |
| [RecoverableError](classes/RecoverableError.md) | Abstract base for failures the caller may retry or defer. The library never retries the caller's operation itself - it classifies the failure as recoverable and returns control so the caller can apply its own backoff, escalation, or alternative-path policy. |
| [AccessBootstrapStage](type-aliases/AccessBootstrapStage.md) | The stages of the `connect()` sequence that carry a [AccessBootstrapError](classes/AccessBootstrapError.md) tag. The sequence authenticates, fetches the bootstrap document, parses it, then subscribes to the realtime stream; only the fetch and parse stages are wrapped as a bootstrap error, because a login or reachability failure already propagates as its own typed fatal (`AccessAuthError` / `AccessNetworkError`), and a subscribe failure surfaces as the fault the realtime channel itself raised. |
| [AccessIdentityLeg](type-aliases/AccessIdentityLeg.md) | The two identities a client can authenticate with, and which an [AccessAuthError](classes/AccessAuthError.md) or an [AccessAuthorizationError](classes/AccessAuthorizationError.md) names as the refused one: `"credentials"` is the account login session that authenticates the direct API, `"token"` the bearer token that authenticates the official API. A client holds either or both - the `ConnectIdentity` union is how a caller supplies them - and each is refused independently, so the leg is what tells a user which of the two to go fix. |
| [AccessOfficialApiCode](type-aliases/AccessOfficialApiCode.md) | The official API's result-code vocabulary: every code the reference documents, plus any code the controller sends that the documentation does not list. |

## Diagnostics

| Name | Description |
| ------ | ------ |
| [AccessEventsClosedPayload](interfaces/AccessEventsClosedPayload.md) | Payload published on [channels.eventsClosed](variables/channels.md#property-eventsclosed). `code` and `reason` mirror the WebSocket close frame. |
| [AccessHttpRequestCommon](interfaces/AccessHttpRequestCommon.md) | The fields every request payload carries, named once here so the start payload and the end payload cannot drift apart on the identity of the request they describe. `requestId` is what correlates the two. |
| [AccessHttpThrottleEnteredPayload](interfaces/AccessHttpThrottleEnteredPayload.md) | Payload published on [channels.httpThrottleEntered](variables/channels.md#property-httpthrottleentered). `consecutiveFailures` is the count that crossed the limit and `cooldownMs` is how long the transport will refuse requests before it allows a recovery probe through. |
| [AccessHttpThrottleExitedPayload](interfaces/AccessHttpThrottleExitedPayload.md) | Payload published on [channels.httpThrottleExited](variables/channels.md#property-httpthrottleexited). The recovery carries no detail of its own beyond which controller recovered - the cooldown that just ended was already reported on the entered channel. |
| [AccessStoreDispatchPayload](interfaces/AccessStoreDispatchPayload.md) | Payload published on the `unifi-access:store:dispatch` channel. `kind` is the event's own tag, taken from the typed union the reducer folds, so the vocabulary here is the reducer's rather than a second list that could fall behind it. |
| [AccessAuthReloginPayload](type-aliases/AccessAuthReloginPayload.md) | Payload published on [channels.authRelogin](variables/channels.md#property-authrelogin). The two arms encode which recoveries are possible. With credentials retained, the relogin ran against the controller and `success` reports whether it re-established the session. With none - the state an explicit logout leaves behind - there was nothing to attempt, so `host` is null and the attempt cannot have succeeded. Splitting the arms rather than making `host` nullable on one shape means the combination that would claim a recovery nobody attempted cannot be constructed at all. |
| [AccessConnectionTransitionPayload](type-aliases/AccessConnectionTransitionPayload.md) | Payload published on the `unifi-access:connection:transition` channel. Composed from the monitor's own transition type plus the controller this client addresses, so a change to what a connection state can be cannot drift this payload away from it - the same reason the request payloads compose from their shared fields rather than restating them. |
| [AccessEventsPacketIdKind](type-aliases/AccessEventsPacketIdKind.md) | The event kinds that carry an entity identifier, derived from the wire-event union itself rather than restated, so this vocabulary cannot drift from the classifier that produces it. Deriving from [AccessWireEvent](type-aliases/AccessWireEvent.md) also excludes the synthetic bootstrap member by construction, because that member is never carried by the notification stream. |
| [AccessEventsPacketNoIdKind](type-aliases/AccessEventsPacketNoIdKind.md) | The event kinds that carry no entity identifier, derived as the exact complement of [AccessEventsPacketIdKind](type-aliases/AccessEventsPacketIdKind.md) so the two vocabularies partition the wire union between them and neither can drift from the classifier that produces it. |
| [AccessEventsPacketPayload](type-aliases/AccessEventsPacketPayload.md) | Payload published on [channels.eventsPacket](variables/channels.md#property-eventspacket). `eventName` is the notification name exactly as the controller sent it, which is what a consumer needs to tell the controller's two notification dialects apart after the classifier has normalized them into one kind. |
| [AccessHttpRequestEndOutcome](type-aliases/AccessHttpRequestEndOutcome.md) | How a request finished, as the two outcomes a dispatch can actually have. A response arrived and carries its status, or the request failed at the transport level and carries the classified error's message with no status at all, because none was ever received. As a union rather than a pair of optional fields, reading a status code requires narrowing to the arm that has one, so a consumer cannot read a status from a failure that never had one. |
| [AccessHttpRequestEndPayload](type-aliases/AccessHttpRequestEndPayload.md) | Payload published on [channels.httpRequestEnd](variables/channels.md#property-httprequestend). Composed from the shared request fields, the measured duration and host, and the outcome union, so each piece is defined once. `durationMs` spans dispatch to settle and is measured on the transport's own injected clock. |
| [AccessHttpRequestStartPayload](type-aliases/AccessHttpRequestStartPayload.md) | Payload published on [channels.httpRequestStart](variables/channels.md#property-httprequeststart). The shared request fields plus the controller this client addresses. |
| [channels](variables/channels.md) | The library's observability surface, expressed as `node:diagnostics_channel` publishers. |

## Utilities

| Name | Description |
| ------ | ------ |
| [Clock](interfaces/Clock.md) | Source of time for any code that needs to know "what time is it now?" or "wake me up at intervals." Production code reads time exclusively through this interface, never through `Date.now()` or `node:timers/promises` directly. Tests substitute a fake clock to drive time deterministically without real-time waits or module-level mocking. |
| [noopLog](variables/noopLog.md) | The default logger every subsystem falls back to when a consumer injects none. It discards every message at every level. |
| [wallClock](variables/wallClock.md) | The production clock. Reads wall-clock time via `Date.now()` and timers via `node:timers/promises`. This shim is the single bridge between the `Clock` interface and Node's runtime; consumers always go through `Clock`, never directly to the Node primitives, so an unmocked call site behaves exactly like a direct `Date.now()` or `node:timers/promises` call would. |

## Other

| Name | Description |
| ------ | ------ |
| [AccessApiResponseInterface](interfaces/AccessApiResponseInterface.md) | A description of the UniFi Access API response JSON, the envelope wrapping the result of a REST call. |
| [AccessBootstrapConfigInterface](interfaces/AccessBootstrapConfigInterface.md) | A semi-complete description of the UniFi Access topology JSON, which we use to bootstrap. This is the root of the location hierarchy: a `building` location holding the floors, and optionally holding hardware directly when a device is attached to the building rather than to one of its doors. |
| [AccessControllerConfigInterface](interfaces/AccessControllerConfigInterface.md) | A semi-complete description of the UniFi Access controller JSON. |
| [AccessControllerSettingsConfigInterface](interfaces/AccessControllerSettingsConfigInterface.md) | A semi-complete description of the UniFi Access controller settings JSON. |
| [AccessDeviceConfigInterface](interfaces/AccessDeviceConfigInterface.md) | A semi-complete description of the UniFi Access device JSON. |
| [AccessDeviceEntryConfigInterface](interfaces/AccessDeviceEntryConfigInterface.md) | A semi-complete description of the UniFi Access device entry configuration JSON. Each entry is one key-value setting row the controller keeps for a device. |
| [AccessDoorConfigInterface](interfaces/AccessDoorConfigInterface.md) | A description of the UniFi Access door JSON: a location that hardware is attached to, carrying the readers assigned to it and the door-specific guard, hotel, and camera associations. |
| [AccessDoorStateAlarmInterface](interfaces/AccessDoorStateAlarmInterface.md) | A description of one alarm a door reports. The vocabulary is open: `force_unlock` - the door held open past its relock - is the one value in hand across every capture, so a closed union would be a guess about what else the controller can raise rather than a description of what it does. |
| [AccessDoorStateEmergencyInterface](interfaces/AccessDoorStateEmergencyInterface.md) | A description of a door's emergency condition, reported as the two independent sources that can raise one. `hardware` is a physical emergency input wired to the hub; `software` is a controller-issued emergency state. Both are open strings, observed as `none` when no emergency is in force. |
| [AccessDoorStateEntryInterface](interfaces/AccessDoorStateEntryInterface.md) | A description of one door's live state, as the controller reports it on its newer notification dialect. Verified against live captures: a door hub sends an array of these under `location_states` on a device update, and a door location sends the identical shape as its `state` member on a location update. |
| [AccessDoorStateSuspendInterface](interfaces/AccessDoorStateSuspendInterface.md) | A description of a door's unlock suspension - the controller's own record of a scheduled unlock that was suspended. `status` reports where the suspension stands and `unlock_type` names the unlock it applies to, both open strings, and both observed empty or `end` on a door with nothing suspended. |
| [AccessEventDoorbellCancelInterface](interfaces/AccessEventDoorbellCancelInterface.md) | A description of the UniFi Access doorbell ring cancel event data payload, verified against live captures: a cancellation carries exactly the members declared here and nothing besides. `remote_call_request_id` repeats the `request_id` of the [AccessEventDoorbellRingInterface](interfaces/AccessEventDoorbellRingInterface.md) it ends, which is how a consumer pairs a cancellation with the call it belongs to. |
| [AccessEventDoorbellRingInterface](interfaces/AccessEventDoorbellRingInterface.md) | A description of the UniFi Access doorbell ring event data payload. |
| [AccessEventPacketInterface](interfaces/AccessEventPacketInterface.md) | A complete description of the UniFi Access notification events API packet format. |
| [AccessFloorConfigInterface](interfaces/AccessFloorConfigInterface.md) | A description of the UniFi Access floor JSON: the level of the hierarchy between a building and its doors. |
| [AccessLocationConfigInterface](interfaces/AccessLocationConfigInterface.md) | A description of the UniFi Access location JSON. |
| [AccessLogging](interfaces/AccessLogging.md) | Logging interface, leveraging what we do for Homebridge and elsewhere as a good template. |
| [AccessOfficialPagination](interfaces/AccessOfficialPagination.md) | The pagination a list endpoint reports beside its results. It sits at the top level of the envelope rather than inside the results, on every paginated endpoint the wire has been observed to answer - including the one the reference documents as nesting it, which it does not. |
| [AccessOfficialResult](interfaces/AccessOfficialResult.md) | The result of one official request: the payload the endpoint returned, and the pagination beside it when the endpoint paginates. |
| [AccessUserConfigInterface](interfaces/AccessUserConfigInterface.md) | A semi-complete description of the UniFi Access user JSON, as returned for the authenticated user. |
| [AccessUserGroupConfigInterface](interfaces/AccessUserGroupConfigInterface.md) | A description of a UniFi Access user group JSON, the organizational unit a user belongs to. |
| [AccessUserRoleConfigInterface](interfaces/AccessUserRoleConfigInterface.md) | A description of a UniFi Access user role JSON, the named privilege level assigned to a user. `level` orders roles against each other, and `system_role` marks the roles the controller ships rather than ones an administrator created. |
| [OfficialAccessPolicies](interfaces/OfficialAccessPolicies.md) | The official API's access-policy domain: the policies themselves, the holiday groups a schedule observes, and the schedules a policy grants on. |
| [OfficialApi](interfaces/OfficialApi.md) | The official UniFi Access API, as typed domains over one request path. |
| [OfficialApiServer](interfaces/OfficialApiServer.md) | The official API's own server domain: the TLS certificate the developer port presents. |
| [OfficialCredentials](interfaces/OfficialCredentials.md) | The official API's credential domain: PIN codes, NFC cards and the reader sessions that enroll them, Touch Passes, and visitor QR codes. |
| [OfficialDevices](interfaces/OfficialDevices.md) | The official API's device domain: the adopted inventory, the per-device access-method settings, and the doorbell trigger. |
| [OfficialIdentity](interfaces/OfficialIdentity.md) | The official API's UniFi Identity domain: invitations, and the Identity resources assigned to users and user groups. |
| [OfficialSpaces](interfaces/OfficialSpaces.md) | The official API's spaces domain: the door topology, the door groups composed from it, and the unlock, lock-rule, and emergency controls on the doors. |
| [OfficialSystemLogs](interfaces/OfficialSystemLogs.md) | The official API's system-log domain: the searchable activity record, its CSV export, and the media entries can point at. |
| [OfficialUsers](interfaces/OfficialUsers.md) | The official API's user domain: local accounts, the user-group hierarchy, and the credentials and access policies attached to either. |
| [OfficialVisitors](interfaces/OfficialVisitors.md) | The official API's visitor domain: time-bounded guests, the schedule governing when they may enter, and the credentials issued to them for the visit. |
| [OfficialWebhooks](interfaces/OfficialWebhooks.md) | The official API's webhook administration: the endpoints the controller delivers to. |
| [AccessApiResponse](type-aliases/AccessApiResponse.md) | - |
| [AccessBootstrapConfig](type-aliases/AccessBootstrapConfig.md) | - |
| [AccessBuildingExtrasConfig](type-aliases/AccessBuildingExtrasConfig.md) | - |
| [AccessBuildingExtrasConfigInterface](type-aliases/AccessBuildingExtrasConfigInterface.md) | A description of the extras a `building` location carries: one thumbnail entry per door hub hosted directly by the building, rather than the flat per-door scalars a `door` location reports. The cover is typed as an open JSON value because the controller has only ever sent it as `null`, so its non-null shape is unpinned. |
| [AccessControllerConfig](type-aliases/AccessControllerConfig.md) | - |
| [AccessControllerConfigPayload](type-aliases/AccessControllerConfigPayload.md) | - |
| [AccessControllerSettingsConfig](type-aliases/AccessControllerSettingsConfig.md) | - |
| [AccessDeviceConfig](type-aliases/AccessDeviceConfig.md) | - |
| [AccessDeviceConfigPayload](type-aliases/AccessDeviceConfigPayload.md) | - |
| [AccessDeviceEntryConfig](type-aliases/AccessDeviceEntryConfig.md) | - |
| [AccessDeviceEntryConfigPayload](type-aliases/AccessDeviceEntryConfigPayload.md) | - |
| [AccessDoorConfig](type-aliases/AccessDoorConfig.md) | - |
| [AccessDoorConfigPayload](type-aliases/AccessDoorConfigPayload.md) | - |
| [AccessDoorExtrasConfig](type-aliases/AccessDoorExtrasConfig.md) | - |
| [AccessDoorExtrasConfigInterface](type-aliases/AccessDoorExtrasConfigInterface.md) | A description of the extras a `door` location carries: the door's thumbnail image and the door position sensor (DPS) state reported by an attached hub. |
| [AccessDoorStateAlarm](type-aliases/AccessDoorStateAlarm.md) | - |
| [AccessDoorStateEmergency](type-aliases/AccessDoorStateEmergency.md) | - |
| [AccessDoorStateEntry](type-aliases/AccessDoorStateEntry.md) | - |
| [AccessDoorStateSuspend](type-aliases/AccessDoorStateSuspend.md) | - |
| [AccessEventDoorbellCancel](type-aliases/AccessEventDoorbellCancel.md) | - |
| [AccessEventDoorbellRing](type-aliases/AccessEventDoorbellRing.md) | - |
| [AccessEventPacket](type-aliases/AccessEventPacket.md) | - |
| [AccessFloorConfig](type-aliases/AccessFloorConfig.md) | - |
| [AccessFloorConfigPayload](type-aliases/AccessFloorConfigPayload.md) | - |
| [AccessLocationConfig](type-aliases/AccessLocationConfig.md) | - |
| [AccessLocationExtrasConfig](type-aliases/AccessLocationExtrasConfig.md) | The extras a location carries, selected by that location's own `location_type`. A `door` location carries the scalar thumbnail and DPS fields; a `building` location carries the per-hub `door_thumbnails` array. A `floor` location carries an extras object whose fields are simply all absent, which satisfies the scalar shape structurally, so it needs no branch of its own. |
| [AccessStateFloor](type-aliases/AccessStateFloor.md) | A floor as stored: the wire's floor record without the doors the doors map owns. The topology document is the only census that lists floors. |
| [AccessStateRoot](type-aliases/AccessStateRoot.md) | The topology root as stored: the wire's root record without the floors and the root-level device group that the other maps own. |
| [AccessUserConfig](type-aliases/AccessUserConfig.md) | - |
| [AccessUserGroupConfig](type-aliases/AccessUserGroupConfig.md) | - |
| [AccessUserRoleConfig](type-aliases/AccessUserRoleConfig.md) | - |
| [ACCESS\_API\_ERROR\_LIMIT](variables/ACCESS_API_ERROR_LIMIT.md) | - |
| [ACCESS\_API\_PATH\_PREFIX](variables/ACCESS_API_PATH_PREFIX.md) | - |
| [ACCESS\_API\_RETRY\_INTERVAL](variables/ACCESS_API_RETRY_INTERVAL.md) | - |
| [ACCESS\_API\_TIMEOUT](variables/ACCESS_API_TIMEOUT.md) | - |
| [ACCESS\_BOOTSTRAP\_REFRESH\_INTERVAL](variables/ACCESS_BOOTSTRAP_REFRESH_INTERVAL.md) | - |
| [ACCESS\_EVENTS\_HEARTBEAT\_TIMEOUT](variables/ACCESS_EVENTS_HEARTBEAT_TIMEOUT.md) | - |
| [ACCESS\_OFFICIAL\_API\_PATH\_PREFIX](variables/ACCESS_OFFICIAL_API_PATH_PREFIX.md) | - |
| [ACCESS\_OFFICIAL\_API\_PORT](variables/ACCESS_OFFICIAL_API_PORT.md) | - |
| [ACCESS\_REBOOT\_UPTIME\_DROP\_MINIMUM](variables/ACCESS_REBOOT_UPTIME_DROP_MINIMUM.md) | - |
| [ACCESS\_RECOVERY\_BACKOFF\_MS](variables/ACCESS_RECOVERY_BACKOFF_MS.md) | - |
| [ACCESS\_RECOVERY\_STEADY\_INTERVAL\_MS](variables/ACCESS_RECOVERY_STEADY_INTERVAL_MS.md) | - |

## Reducer

| Type Alias | Description |
| ------ | ------ |
| [AccessState](type-aliases/AccessState.md) | The immutable snapshot of a controller's modeled state. Devices, doors, and floors are normalized into `unique_id -> record` maps for direct lookup, and the topology root is the single record above them, with the controller's own information document and the live door states held beside them. |
| [AccessStateDevice](type-aliases/AccessStateDevice.md) | A device as stored: the record both censuses of the controller's hardware can fill. |
| [AccessStateDoor](type-aliases/AccessStateDoor.md) | A door as stored: the record both censuses of the controller's doors can fill, without the device group the devices map owns. |
