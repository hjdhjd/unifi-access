/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * index.ts: The public surface of the UniFi Access library.
 */

// This file is the consumer contract, and the contract is curated by one rule, expressed in the type system so it cannot drift:
//
//   - `export` a value only for what a consumer constructs, calls as a free function, or tests `instanceof` against: the error hierarchy, the default logger and
//     the production clock a consumer may reuse, and the timing constants.
//   - `export type` only for what a consumer receives but never builds - the interfaces a consumer types its own injected implementations against, and every event,
//     state, option, and domain type reachable from a public signature. Exporting these as types makes a second composition path unrepresentable, so the
//     single-source-of-truth rule is enforced by the compiler rather than by documentation.
//   - Export nothing that is pure composition internals: the `EventBus` facade and the machinery each subsystem is assembled from. They are reachable in source for
//     the reader, never on the published surface.
//
// The test the next contributor applies to any new symbol: does a consumer construct or call it (value), receive it (type), or neither (internal)? That keeps this
// file a deliberate, reviewable contract rather than whatever each module happens to export.

// Errors - the typed hierarchy. Consumers branch on these with `instanceof`, so they are value exports; the bootstrap-stage and identity-leg tags are types.
export { AccessAbortedError, AccessAuthError, AccessAuthorizationError, AccessBootstrapError, AccessCapabilityError, AccessError, AccessNetworkError,
  AccessOfficialApiError, AccessProtocolError, AccessRequestError, AccessStallError, AccessThrottledError, AccessTimeoutError, FatalError,
  RecoverableError } from "./errors.ts";
export type { AccessBootstrapStage, AccessIdentityLeg, AccessOfficialApiCode } from "./errors.ts";

// Logging - the consumer-injectable logger interface and the silent default the library falls back to when a consumer injects none.
export { noopLog } from "./logging.ts";
export type { AccessLogging } from "./logging.ts";

// Clock - the time abstraction every subsystem takes as an injected dependency, and the production implementation a consumer may reuse when composing its own.
export { wallClock } from "./clock.ts";
export type { Clock } from "./clock.ts";

// Client - the composition root a consumer constructs, and the option and event shapes it receives, including the options its stream rail accepts. The client is
// the one way in, so it is a value export while everything it is assembled from stays internal.
export { AccessClient } from "./client/client.ts";
export type { AccessClientEvents, ConnectIdentity, ConnectOptions, ConnectOptionsBase } from "./client/client.ts";
export type { StreamOptions } from "./event-bus.ts";

// Routing - what a client can do, and which of the controller's two APIs its commands take. The capability map is what a consumer receives off the client, and its
// two vocabularies are what a consumer both reads there and writes as a connect option. The routing service, the view the devices tier receives, and the request
// shapes those two pass between them are composition internals like every other subsystem: no published signature accepts or returns one.
export type { AccessApiMode, AccessApiOverride, AccessCapabilities } from "./client/routing.ts";

// Connection - the observable health surface the client exposes as `client.connection`. Types only: a consumer receives the monitor from the client rather than
// constructing one, and reads its transitions and states off it.
export type { ConnectionEvents, ConnectionMonitor, ConnectionState, ConnectionTransition } from "./client/connection.ts";

// Transport - the socket contract a consumer supplies through `ConnectOptionsBase.webSocket`, the event shapes its listeners receive, and the options they are
// registered with. Types only: a consumer that injects its own socket has to be able to name what it hands the client and what comes back through it, and naming
// the interface alone would leave the same gap one level down in the events.
export type { AccessWebSocket, AccessWebSocketCloseEvent, AccessWebSocketErrorEvent, AccessWebSocketListenerOptions,
  AccessWebSocketMessageEvent } from "./transport/ws.ts";

// Devices - the live projections the client hands out. Types only for the same reason: a handle comes from the client or the registry, never from a constructor a
// consumer calls, so publishing the classes as values would offer a second composition path that cannot work.
export type { AccessDevice } from "./devices/device.ts";
export type { AccessDeviceRegistry } from "./devices/registry.ts";
export type { AccessHub, AccessLockRule } from "./devices/hub.ts";

// Diagnostics - the channel roster and the payload types a subscriber receives. The roster is a value export because a consumer holds it: it iterates the set to observe
// every channel at once, or reaches one channel off it to subscribe with a typed handler. Subscribing by name through the platform's own diagnostics surface is equally
// supported and delivers the same payloads, so the roster is a convenience over the channel names rather than the only way in. The payload types cover every channel,
// because what a consumer receives is exactly what the curation rule publishes as a type.
export { channels } from "./diagnostics.ts";
export type { AccessAuthReloginPayload, AccessConnectionTransitionPayload, AccessEventsClosedPayload, AccessEventsPacketPayload, AccessHttpRequestCommon,
  AccessHttpRequestEndOutcome, AccessHttpRequestEndPayload, AccessHttpRequestStartPayload, AccessHttpThrottleEnteredPayload, AccessHttpThrottleExitedPayload,
  AccessStoreDispatchPayload } from "./diagnostics.ts";

// Protocol - the typed event a consumer receives and the state shapes it observes. Types only: the classifier and the reducer are composition internals, and they
// reach consumers through the client that wraps them rather than as free functions. The wire-event narrowing is published alongside the full union because a
// consumer reading the notification rails only ever receives that narrower half. The stored record shapes are what every census fills, so a consumer types its
// records as these rather than as the wire types, and the compiler names every member its client's own census may not have established.
export type { AccessState, AccessStateDevice, AccessStateDoor, AccessStateFloor, AccessStateRoot } from "./protocol/reducer.ts";
export type { AccessTypedEvent, AccessWireEvent } from "./protocol/events.ts";
export { isAccessEventPacket } from "./protocol/events.ts";
export type { AccessEventsPacketIdKind, AccessEventsPacketNoIdKind } from "./diagnostics.ts";

// Vocabulary - the cross-channel translations the controller's own inconsistent spelling makes necessary. Value exports because a consumer calls the folds and reads
// the reason-code table as free surface, exactly as it does the selectors: the alternative is every consumer re-deriving the same facts about the wire. The address
// pair is published for the same reason a consumer keys on an address at all: whatever it stored under one spelling, it folds with the library's own rule.
export { ACCESS_AUTHENTICATION_TYPES, ACCESS_DOORBELL_REASON_CODES, isMacAddress, normalizeActorType, normalizeMacAddress } from "./protocol/vocabulary.ts";
export type { AccessActorType } from "./protocol/vocabulary.ts";

// Official API - the facade a consumer reaches through `client.official`, the webhook payload shapes it receives on its own HTTP surface, and the pure function that
// establishes a delivery is authentic. The facade and its ten domains are types rather than values, because a consumer receives them from the client rather than
// constructing them: the client is the one composition root and official access hangs off it rather than beside it, so the token session and the request path
// underneath stay internal. The two values here are what a consumer calls on its own webhook endpoint, which needs no client at all: the guard that narrows a
// parsed body to the delivery union, and the verification that establishes the delivery is authentic.
export { isAccessWebhookDelivery, verifyWebhookSignature } from "./official/webhooks.ts";
export type { OfficialAccessPolicies } from "./official/policies.ts";
export type { OfficialApi } from "./official/api.ts";
export type { OfficialApiServer } from "./official/server.ts";
export type { OfficialCredentials } from "./official/credentials.ts";
export type { OfficialDevices } from "./official/devices.ts";
export type { OfficialIdentity } from "./official/identity.ts";
export type { OfficialSpaces } from "./official/spaces.ts";
export type { OfficialSystemLogs } from "./official/logs.ts";
export type { OfficialUsers } from "./official/users.ts";
export type { OfficialVisitors } from "./official/visitors.ts";
export type { OfficialWebhooks } from "./official/webhooks.ts";
export type { AccessWebhookActor, AccessWebhookDelivery, AccessWebhookDevice, AccessWebhookDoorUnlockObject, AccessWebhookDoorbellCompletedObject,
  AccessWebhookDoorbellIncomingObject, AccessWebhookDoorbellRenObject, AccessWebhookDpsStatusObject, AccessWebhookEmergencyStatusObject, AccessWebhookEvent,
  AccessWebhookLocation, AccessWebhookSignature, AccessWebhookUnmodeledObject } from "./official/webhooks.ts";

// Official API domains - the request, response, and entity shapes of every endpoint the reference publishes, one block per domain. Types only, and that is the
// whole point of the section: a consumer receives these off the facade the client exposes, and never constructs a domain or the request path underneath it. The
// naming makes the set enumerable - everything here is an `AccessOfficial*` type reachable from one of those methods' signatures.
export type { AccessOfficialCallOptions, AccessOfficialFileUpload, AccessOfficialFormPart, AccessOfficialPagination, AccessOfficialRequestOptions,
  AccessOfficialResult } from "./official/dispatch.ts";
export type { AccessOfficialPageOptions, AccessOfficialQuery } from "./official/endpoints.ts";
export type { AccessOfficialAccessPolicy, AccessOfficialAccessPolicyCreate, AccessOfficialAccessPolicyResource, AccessOfficialAccessPolicyResourceRef,
  AccessOfficialAccessPolicyUpdate, AccessOfficialHoliday, AccessOfficialHolidayCreate, AccessOfficialHolidayGroup, AccessOfficialHolidayGroupCreate,
  AccessOfficialHolidayGroupSummary, AccessOfficialHolidayGroupUpdate, AccessOfficialSchedule, AccessOfficialScheduleCreate, AccessOfficialScheduleUpdate,
  AccessOfficialScheduleWindow, AccessOfficialWeekSchedule } from "./official/policies.ts";
export type { AccessOfficialLicensePlate, AccessOfficialNfcCard, AccessOfficialNfcCardEnroll, AccessOfficialNfcCardImportResult, AccessOfficialNfcCardRef,
  AccessOfficialNfcCardUpdate, AccessOfficialNfcCardUser, AccessOfficialNfcEnrollmentSession, AccessOfficialNfcEnrollmentStatus, AccessOfficialPinCodeRef,
  AccessOfficialTouchPass, AccessOfficialTouchPassBundle, AccessOfficialTouchPassBundleUpdate, AccessOfficialTouchPassListOptions,
  AccessOfficialTouchPassUpdate } from "./official/credentials.ts";
export type { AccessOfficialTouchPassBatchAssign, AccessOfficialUser, AccessOfficialUserAccessPolicyOptions, AccessOfficialUserAvatar,
  AccessOfficialUserCreate, AccessOfficialUserCreated, AccessOfficialUserExpand, AccessOfficialUserFetchOptions, AccessOfficialUserGroup,
  AccessOfficialUserGroupCreate, AccessOfficialUserGroupMember, AccessOfficialUserGroupUpdate, AccessOfficialUserListOptions, AccessOfficialUserNfcCardAssign,
  AccessOfficialUserSearchOptions, AccessOfficialUserSearchResult, AccessOfficialUserUpdate } from "./official/users.ts";
export type { AccessOfficialVisitor, AccessOfficialVisitorCreate, AccessOfficialVisitorDeleteOptions, AccessOfficialVisitorExpand,
  AccessOfficialVisitorListOptions, AccessOfficialVisitorNfcCardAssign, AccessOfficialVisitorResource, AccessOfficialVisitorResourceRef,
  AccessOfficialVisitorSchedule, AccessOfficialVisitorUpdate } from "./official/visitors.ts";
export type { AccessOfficialDoor, AccessOfficialDoorEntryMethod, AccessOfficialDoorGroup, AccessOfficialDoorGroupCreate, AccessOfficialDoorGroupResource,
  AccessOfficialDoorGroupTopology, AccessOfficialDoorGroupUpdate, AccessOfficialDoorUnlockActor, AccessOfficialDoorUnlockOptions, AccessOfficialEmergencyState,
  AccessOfficialEmergencyStatus, AccessOfficialLockRule, AccessOfficialLockRuleSet, AccessOfficialResourceTopology,
  AccessOfficialTopologyResource } from "./official/spaces.ts";
export type { AccessOfficialAccessMethodFace, AccessOfficialAccessMethodFaceUpdate, AccessOfficialAccessMethodPinCode,
  AccessOfficialAccessMethodPinCodeUpdate, AccessOfficialAccessMethodToggle, AccessOfficialAccessMethodValue, AccessOfficialAccessMethods,
  AccessOfficialAccessMethodsUpdate, AccessOfficialDevice, AccessOfficialDeviceListOptions, AccessOfficialDeviceSettings, AccessOfficialDeviceSettingsUpdate,
  AccessOfficialDoorbellTriggerOptions } from "./official/devices.ts";
export type { AccessOfficialSystemLogActor, AccessOfficialSystemLogAuthentication, AccessOfficialSystemLogEvent, AccessOfficialSystemLogExportOptions,
  AccessOfficialSystemLogFetchOptions, AccessOfficialSystemLogHit, AccessOfficialSystemLogHits, AccessOfficialSystemLogResource,
  AccessOfficialSystemLogSource, AccessOfficialSystemLogTarget, AccessOfficialSystemLogTopic } from "./official/logs.ts";
export type { AccessOfficialIdentityAssignment, AccessOfficialIdentityInvitation, AccessOfficialIdentityInvitationFailure, AccessOfficialIdentityResource,
  AccessOfficialIdentityResourceMap, AccessOfficialIdentityResourceOptions, AccessOfficialIdentityResourceType } from "./official/identity.ts";
export type { AccessOfficialWebhookEndpoint, AccessOfficialWebhookEndpointWrite, AccessOfficialWebhookEventName } from "./official/webhooks.ts";
export type { AccessOfficialCertificateUpload } from "./official/server.ts";

// State - the memoized derived views a consumer reads its observed state through, and the store's own construction surface. The selectors are value exports because
// a consumer calls them as free functions, and passes them to `client.state.observe` to be told when what they select changes. The store factory is the one
// documented exception to composing through the client, for a harness that needs the real engine standalone. The classification predicates are published beside the
// selectors because they are the one home of device-role qualification - the hub predicates are what the projections rest on - and a consumer re-deriving any of
// them is the drift the selectors module warns against. The tamper pair publishes here on the same terms: a capability predicate and a per-record read, so that
// what a record says about tampering has one home rather than being re-derived from the raw configuration rows by every consumer that wants it.
export { createStateStore } from "./state/store.ts";
export type { StateStore, StateStoreOptions } from "./state/store.ts";
export { isEnterpriseHubRecord, isHub, isReader, isTamperCapable, selectAccessPoints, selectController, selectControllerName, selectControllerUptime,
  selectDevicesByType, selectDoorDevices, selectDoorStates, selectHubs, tamperState } from "./state/selectors.ts";

// Settings - the externally observable timing and retry constants behind the library's defaults, exposed as documented reference values.
export { ACCESS_API_ERROR_LIMIT, ACCESS_API_PATH_PREFIX, ACCESS_API_RETRY_INTERVAL, ACCESS_API_TIMEOUT, ACCESS_BOOTSTRAP_REFRESH_INTERVAL,
  ACCESS_EVENTS_HEARTBEAT_TIMEOUT, ACCESS_OFFICIAL_API_PATH_PREFIX, ACCESS_OFFICIAL_API_PORT, ACCESS_REBOOT_UPTIME_DROP_MINIMUM, ACCESS_RECOVERY_BACKOFF_MS,
  ACCESS_RECOVERY_STEADY_INTERVAL_MS } from "./settings.ts";

// Domain types - the Access wire and configuration shapes. Every export here is intentionally public; consumers type their controller interactions against these. The
// list is named rather than wildcarded so that adding a type to the tier is a deliberate act of publishing it, not a side effect.
export type { AccessApiResponse, AccessApiResponseInterface, AccessBootstrapConfig, AccessBootstrapConfigInterface, AccessBuildingExtrasConfig,
  AccessBuildingExtrasConfigInterface, AccessControllerConfig, AccessControllerConfigInterface, AccessControllerConfigPayload, AccessControllerSettingsConfig,
  AccessControllerSettingsConfigInterface, AccessDeviceConfig, AccessDeviceConfigInterface, AccessDeviceConfigPayload, AccessDeviceEntryConfig,
  AccessDeviceEntryConfigInterface, AccessDeviceEntryConfigPayload, AccessDoorConfig, AccessDoorConfigInterface, AccessDoorConfigPayload, AccessDoorExtrasConfig,
  AccessDoorExtrasConfigInterface, AccessDoorStateAlarm, AccessDoorStateAlarmInterface, AccessDoorStateEmergency, AccessDoorStateEmergencyInterface,
  AccessDoorStateEntry, AccessDoorStateEntryInterface, AccessDoorStateSuspend, AccessDoorStateSuspendInterface,
  AccessEventDoorbellCancel, AccessEventDoorbellCancelInterface, AccessEventDoorbellRing, AccessEventDoorbellRingInterface,
  AccessEventPacket, AccessEventPacketInterface, AccessEventTamperAlert, AccessEventTamperAlertInterface, AccessFloorConfig, AccessFloorConfigInterface,
  AccessFloorConfigPayload, AccessKnownJsonValue, AccessLocationConfig, AccessLocationConfigInterface, AccessLocationExtrasConfig,
  AccessUserConfig, AccessUserConfigInterface, AccessUserGroupConfig, AccessUserGroupConfigInterface, AccessUserRoleConfig,
  AccessUserRoleConfigInterface, Nullable } from "./types/index.ts";
