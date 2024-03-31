[unifi-access](../README.md) / [Exports](../modules.md) / AccessApi

# Class: AccessApi

The direct UniFi Access API is partially documented through an officially supported public API that Ubiquiti has released. However, this API also has certain
constraints and limitations such as lacking the ability to change the settings on an Access device. The full native API has been reverse engineered mostly through
trail and error with the Access web interface as well as insight from the public API.

Here's how the UniFi Access API works:

1. [Login](AccessApi.md#login) to the UniFi Access controller and acquire security credentials for further calls to the API.

2. Enumerate the list of UniFi Access devices by calling the [bootstrap](AccessApi.md#bootstrap) property. This contains everything you would want to know about the devices attached to
   this particular UniFi Access controller. Information about the Access controller can be accessed through the [controller](AccessApi.md#controller) property.

3. Listen for `message` events emitted by [AccessApi](AccessApi.md) containing all Access controller events, in realtime. They are delivered as [AccessEventPacket](../modules.md#accesseventpacket)
   packets, containing the event-specific details.

Those are the basics that gets us up and running.

## Hierarchy

- `EventEmitter`

  ↳ **`AccessApi`**

## Table of contents

### Constructors

- [constructor](AccessApi.md#constructor)

### Properties

- [captureRejectionSymbol](AccessApi.md#capturerejectionsymbol)
- [captureRejections](AccessApi.md#capturerejections)
- [defaultMaxListeners](AccessApi.md#defaultmaxlisteners)
- [errorMonitor](AccessApi.md#errormonitor)

### Accessors

- [bootstrap](AccessApi.md#bootstrap)
- [controller](AccessApi.md#controller)
- [devices](AccessApi.md#devices)
- [doors](AccessApi.md#doors)
- [floors](AccessApi.md#floors)
- [isAdminUser](AccessApi.md#isadminuser)
- [name](AccessApi.md#name)

### Methods

- [[captureRejectionSymbol]](AccessApi.md#[capturerejectionsymbol])
- [addListener](AccessApi.md#addlistener)
- [emit](AccessApi.md#emit)
- [eventNames](AccessApi.md#eventnames)
- [getApiEndpoint](AccessApi.md#getapiendpoint)
- [getBootstrap](AccessApi.md#getbootstrap)
- [getDeviceName](AccessApi.md#getdevicename)
- [getFullName](AccessApi.md#getfullname)
- [getMaxListeners](AccessApi.md#getmaxlisteners)
- [listenerCount](AccessApi.md#listenercount)
- [listeners](AccessApi.md#listeners)
- [login](AccessApi.md#login)
- [logout](AccessApi.md#logout)
- [off](AccessApi.md#off)
- [on](AccessApi.md#on)
- [once](AccessApi.md#once)
- [prependListener](AccessApi.md#prependlistener)
- [prependOnceListener](AccessApi.md#prependoncelistener)
- [rawListeners](AccessApi.md#rawlisteners)
- [removeAllListeners](AccessApi.md#removealllisteners)
- [removeListener](AccessApi.md#removelistener)
- [reset](AccessApi.md#reset)
- [retrieve](AccessApi.md#retrieve)
- [setMaxListeners](AccessApi.md#setmaxlisteners)
- [unlock](AccessApi.md#unlock)
- [updateDevice](AccessApi.md#updatedevice)
- [addAbortListener](AccessApi.md#addabortlistener)
- [getEventListeners](AccessApi.md#geteventlisteners)
- [getMaxListeners](AccessApi.md#getmaxlisteners-1)
- [listenerCount](AccessApi.md#listenercount-1)
- [on](AccessApi.md#on-1)
- [once](AccessApi.md#once-1)
- [setMaxListeners](AccessApi.md#setmaxlisteners-1)

## Constructors

### constructor

• **new AccessApi**(`log?`): [`AccessApi`](AccessApi.md)

Create an instance of the UniFi Access API.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `log?` | [`AccessLogging`](../interfaces/AccessLogging.md) | Logging functions to use. |

#### Returns

[`AccessApi`](AccessApi.md)

**`Default Value`**

`none` - Logging will be done to stdout and stderr.

#### Overrides

EventEmitter.constructor

#### Defined in

[src/access-api.ts:65](https://github.com/hjdhjd/unifi-access/blob/e0dcb0f/src/access-api.ts#L65)

## Properties

### captureRejectionSymbol

▪ `Static` `Readonly` **captureRejectionSymbol**: typeof [`captureRejectionSymbol`](AccessApi.md#capturerejectionsymbol)

Value: `Symbol.for('nodejs.rejection')`

See how to write a custom `rejection handler`.

**`Since`**

v13.4.0, v12.16.0

#### Inherited from

EventEmitter.captureRejectionSymbol

#### Defined in

node_modules/@types/node/events.d.ts:415

___

### captureRejections

▪ `Static` **captureRejections**: `boolean`

Value: [boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Boolean_type)

Change the default `captureRejections` option on all new `EventEmitter` objects.

**`Since`**

v13.4.0, v12.16.0

#### Inherited from

EventEmitter.captureRejections

#### Defined in

node_modules/@types/node/events.d.ts:422

___

### defaultMaxListeners

▪ `Static` **defaultMaxListeners**: `number`

By default, a maximum of `10` listeners can be registered for any single
event. This limit can be changed for individual `EventEmitter` instances
using the `emitter.setMaxListeners(n)` method. To change the default
for _all_`EventEmitter` instances, the `events.defaultMaxListeners`property can be used. If this value is not a positive number, a `RangeError`is thrown.

Take caution when setting the `events.defaultMaxListeners` because the
change affects _all_`EventEmitter` instances, including those created before
the change is made. However, calling `emitter.setMaxListeners(n)` still has
precedence over `events.defaultMaxListeners`.

This is not a hard limit. The `EventEmitter` instance will allow
more listeners to be added but will output a trace warning to stderr indicating
that a "possible EventEmitter memory leak" has been detected. For any single`EventEmitter`, the `emitter.getMaxListeners()` and `emitter.setMaxListeners()`methods can be used to
temporarily avoid this warning:

```js
import { EventEmitter } from 'node:events';
const emitter = new EventEmitter();
emitter.setMaxListeners(emitter.getMaxListeners() + 1);
emitter.once('event', () => {
  // do stuff
  emitter.setMaxListeners(Math.max(emitter.getMaxListeners() - 1, 0));
});
```

The `--trace-warnings` command-line flag can be used to display the
stack trace for such warnings.

The emitted warning can be inspected with `process.on('warning')` and will
have the additional `emitter`, `type`, and `count` properties, referring to
the event emitter instance, the event's name and the number of attached
listeners, respectively.
Its `name` property is set to `'MaxListenersExceededWarning'`.

**`Since`**

v0.11.2

#### Inherited from

EventEmitter.defaultMaxListeners

#### Defined in

node_modules/@types/node/events.d.ts:459

___

### errorMonitor

▪ `Static` `Readonly` **errorMonitor**: typeof [`errorMonitor`](AccessApi.md#errormonitor)

This symbol shall be used to install a listener for only monitoring `'error'`events. Listeners installed using this symbol are called before the regular`'error'` listeners are called.

Installing a listener using this symbol does not change the behavior once an`'error'` event is emitted. Therefore, the process will still crash if no
regular `'error'` listener is installed.

**`Since`**

v13.6.0, v12.17.0

#### Inherited from

EventEmitter.errorMonitor

#### Defined in

node_modules/@types/node/events.d.ts:408

## Accessors

### bootstrap

• `get` **bootstrap**(): ``null`` \| `Readonly`\<[`AccessBootstrapConfigInterface`](../interfaces/AccessBootstrapConfigInterface.md)\>

Access the Access controller bootstrap JSON.

#### Returns

``null`` \| `Readonly`\<[`AccessBootstrapConfigInterface`](../interfaces/AccessBootstrapConfigInterface.md)\>

Returns the bootstrap JSON if the Access controller has been bootstrapped, `null` otherwise.

#### Defined in

[src/access-api.ts:1030](https://github.com/hjdhjd/unifi-access/blob/e0dcb0f/src/access-api.ts#L1030)

___

### controller

• `get` **controller**(): ``null`` \| `Readonly`\<[`AccessControllerConfigInterface`](../interfaces/AccessControllerConfigInterface.md)\>

Access the Access controller information JSON.

#### Returns

``null`` \| `Readonly`\<[`AccessControllerConfigInterface`](../interfaces/AccessControllerConfigInterface.md)\>

Returns the controller information JSON if the Access controller has been bootstrapped, `null` otherwise.

#### Defined in

[src/access-api.ts:1019](https://github.com/hjdhjd/unifi-access/blob/e0dcb0f/src/access-api.ts#L1019)

___

### devices

• `get` **devices**(): ``null`` \| `Readonly`\<[`AccessDeviceConfigInterface`](../interfaces/AccessDeviceConfigInterface.md)\>[]

Access the Access controller list of devices.

#### Returns

``null`` \| `Readonly`\<[`AccessDeviceConfigInterface`](../interfaces/AccessDeviceConfigInterface.md)\>[]

Returns an array of all the devices from all the UniFi Access hubs associated with this controller, `null` otherwise.

#### Defined in

[src/access-api.ts:1041](https://github.com/hjdhjd/unifi-access/blob/e0dcb0f/src/access-api.ts#L1041)

___

### doors

• `get` **doors**(): ``null`` \| `Readonly`\<[`AccessDoorConfigInterface`](../interfaces/AccessDoorConfigInterface.md)\>[]

Access the Access controller list of doors.

#### Returns

``null`` \| `Readonly`\<[`AccessDoorConfigInterface`](../interfaces/AccessDoorConfigInterface.md)\>[]

Returns an array of all the doors from all the UniFi Access hubs associated with this controller, `null` otherwise.

#### Defined in

[src/access-api.ts:1052](https://github.com/hjdhjd/unifi-access/blob/e0dcb0f/src/access-api.ts#L1052)

___

### floors

• `get` **floors**(): ``null`` \| `Readonly`\<[`AccessFloorConfigInterface`](../interfaces/AccessFloorConfigInterface.md)\>[]

Access the Access controller list of floors.

#### Returns

``null`` \| `Readonly`\<[`AccessFloorConfigInterface`](../interfaces/AccessFloorConfigInterface.md)\>[]

Returns an array of all the floors from all the UniFi Access hubs associated with this controller, `null` otherwise.

#### Defined in

[src/access-api.ts:1063](https://github.com/hjdhjd/unifi-access/blob/e0dcb0f/src/access-api.ts#L1063)

___

### isAdminUser

• `get` **isAdminUser**(): `boolean`

Utility method that returns whether the credentials that were used to login to the Access controller have administrative privileges or not.

#### Returns

`boolean`

Returns `true` if the logged in user has administrative privileges, `false` otherwise.

#### Defined in

[src/access-api.ts:1074](https://github.com/hjdhjd/unifi-access/blob/e0dcb0f/src/access-api.ts#L1074)

___

### name

• `get` **name**(): `string`

Utility method that returns a nicely formatted version of the Access controller name.

#### Returns

`string`

Returns the Access controller name in the following format:
  <code>*Access controller name* [*Access controller type*]</code>.

#### Defined in

[src/access-api.ts:1086](https://github.com/hjdhjd/unifi-access/blob/e0dcb0f/src/access-api.ts#L1086)

## Methods

### [captureRejectionSymbol]

▸ **[captureRejectionSymbol]**\<`K`\>(`error`, `event`, `...args`): `void`

#### Type parameters

| Name |
| :------ |
| `K` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `error` | `Error` |
| `event` | `string` \| `symbol` |
| `...args` | `AnyRest` |

#### Returns

`void`

#### Inherited from

EventEmitter.[captureRejectionSymbol]

#### Defined in

node_modules/@types/node/events.d.ts:125

___

### addListener

▸ **addListener**\<`K`\>(`eventName`, `listener`): `this`

Alias for `emitter.on(eventName, listener)`.

#### Type parameters

| Name |
| :------ |
| `K` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `eventName` | `string` \| `symbol` |
| `listener` | (...`args`: `any`[]) => `void` |

#### Returns

`this`

**`Since`**

v0.1.26

#### Inherited from

EventEmitter.addListener

#### Defined in

node_modules/@types/node/events.d.ts:558

___

### emit

▸ **emit**\<`K`\>(`eventName`, `...args`): `boolean`

Synchronously calls each of the listeners registered for the event named`eventName`, in the order they were registered, passing the supplied arguments
to each.

Returns `true` if the event had listeners, `false` otherwise.

```js
import { EventEmitter } from 'node:events';
const myEmitter = new EventEmitter();

// First listener
myEmitter.on('event', function firstListener() {
  console.log('Helloooo! first listener');
});
// Second listener
myEmitter.on('event', function secondListener(arg1, arg2) {
  console.log(`event with parameters ${arg1}, ${arg2} in second listener`);
});
// Third listener
myEmitter.on('event', function thirdListener(...args) {
  const parameters = args.join(', ');
  console.log(`event with parameters ${parameters} in third listener`);
});

console.log(myEmitter.listeners('event'));

myEmitter.emit('event', 1, 2, 3, 4, 5);

// Prints:
// [
//   [Function: firstListener],
//   [Function: secondListener],
//   [Function: thirdListener]
// ]
// Helloooo! first listener
// event with parameters 1, 2 in second listener
// event with parameters 1, 2, 3, 4, 5 in third listener
```

#### Type parameters

| Name |
| :------ |
| `K` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `eventName` | `string` \| `symbol` |
| `...args` | `AnyRest` |

#### Returns

`boolean`

**`Since`**

v0.1.26

#### Inherited from

EventEmitter.emit

#### Defined in

node_modules/@types/node/events.d.ts:820

___

### eventNames

▸ **eventNames**(): (`string` \| `symbol`)[]

Returns an array listing the events for which the emitter has registered
listeners. The values in the array are strings or `Symbol`s.

```js
import { EventEmitter } from 'node:events';

const myEE = new EventEmitter();
myEE.on('foo', () => {});
myEE.on('bar', () => {});

const sym = Symbol('symbol');
myEE.on(sym, () => {});

console.log(myEE.eventNames());
// Prints: [ 'foo', 'bar', Symbol(symbol) ]
```

#### Returns

(`string` \| `symbol`)[]

**`Since`**

v6.0.0

#### Inherited from

EventEmitter.eventNames

#### Defined in

node_modules/@types/node/events.d.ts:883

___

### getApiEndpoint

▸ **getApiEndpoint**(`endpoint`): `string`

Return an API endpoint for the requested endpoint type.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `endpoint` | `string` | Requested endpoint type. |

#### Returns

`string`

Returns a URL to the requested endpoint if successful, and an empty string otherwise.

**`Remarks`**

Valid API endpoints are `bootstrap`, `device`, `login`, `self`, and `websocket`.

#### Defined in

[src/access-api.ts:957](https://github.com/hjdhjd/unifi-access/blob/e0dcb0f/src/access-api.ts#L957)

___

### getBootstrap

▸ **getBootstrap**(): `Promise`\<`boolean`\>

Retrieve the bootstrap JSON from a UniFi Access controller.

#### Returns

`Promise`\<`boolean`\>

Returns a promise that will resolve to `true` if successful and `false` otherwise.

**`Remarks`**

A `bootstrap` event will be emitted each time this method is successfully called, with the AccessToplogyConfig JSON as an argument. As a
convenience, the [devices](AccessApi.md#devices), [doors](AccessApi.md#doors), and [floors](AccessApi.md#floors) properties will be populated as well.

**`Example`**

Retrieve the bootstrap JSON. You can selectively choose to either `await` the promise that is returned by `getBootstrap`, or subscribe to the `bootstrap` event.

```ts
import { AccessApi, AccessDeviceConfig } from "unifi-access";
import util from "node:util";

// Create a new Access API instance.
const ufa = new AccessApi();

// Set a listener to wait for the bootstrap event to occur.
ufa.once("bootstrap", (bootstrapJSON: AccessDeviceConfig) => {

  // Once we've bootstrapped the Access controller, output the bootstrap JSON and we're done.
  process.stdout.write(util.inspect(bootstrapJSON, { colors: true, depth: null, sorted: true }) + "\n", () => process.exit(0));
});

// Login to the Access controller.
if(!(await ufa.login("access-controller.local", "username", "password"))) {

  console.log("Invalid login credentials.");
  process.exit(0);
};

// Bootstrap the controller. It will emit a message once it's received the bootstrap JSON, or you can alternatively wait for the promise to resolve.
if(!(await ufa.getBootstrap())) {

  console.log("Unable to bootstrap the Access controller.");
  process.exit(0);
}
```

Alternatively, you can access the bootstrap JSON directly through the [bootstrap](AccessApi.md#bootstrap) accessor:

```ts
import { AccessApi } from "unifi-access";
import util from "node:util";

// Create a new Access API instance.
const ufa = new AccessApi();

// Login to the Access controller.
if(!(await ufa.login("access-controller.local", "username", "password"))) {

  console.log("Invalid login credentials.");
  process.exit(0);
};

// Bootstrap the controller.
if(!(await ufa.getBootstrap())) {

  console.log("Unable to bootstrap the Access controller.");
  process.exit(0);
}

// Once we've bootstrapped the Access controller, access the bootstrap JSON through the bootstrap accessor and we're done.
process.stdout.write(util.inspect(ufa.bootstrap, { colors: true, depth: null, sorted: true }) + "\n", () => process.exit(0));
```

#### Defined in

[src/access-api.ts:514](https://github.com/hjdhjd/unifi-access/blob/e0dcb0f/src/access-api.ts#L514)

___

### getDeviceName

▸ **getDeviceName**(`device`, `name?`, `deviceInfo?`): `string`

Utility method that generates a nicely formatted device information string.

#### Parameters

| Name | Type | Default value | Description |
| :------ | :------ | :------ | :------ |
| `device` | `Readonly`\<[`AccessDeviceConfigInterface`](../interfaces/AccessDeviceConfigInterface.md)\> | `undefined` | Access device. |
| `name` | `string` | `device.name` | Optional name for the device. Defaults to the device type (e.g. `UA G2 Pro Black`). |
| `deviceInfo` | `boolean` | `false` | Optionally specify whether or not to include the IP address and MAC address in the returned string. Defaults to `false`. |

#### Returns

`string`

Returns the Access device name in the following format: <code>*Access device name* [*Access device type*] (address: *IP address* mac: *MAC address*)</code>.

**`Remarks`**

The example above assumed the `deviceInfo` parameter is set to `true`.

#### Defined in

[src/access-api.ts:674](https://github.com/hjdhjd/unifi-access/blob/e0dcb0f/src/access-api.ts#L674)

___

### getFullName

▸ **getFullName**(`device`): `string`

Utility method that generates a combined, nicely formatted device and controller string.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `device` | `Readonly`\<[`AccessDeviceConfigInterface`](../interfaces/AccessDeviceConfigInterface.md)\> | Access device. |

#### Returns

`string`

Returns the Access device name in the following format:
  <code>*Access controller name* [*Access controller type*] *Access device name* [*Access device type*]</code>.

#### Defined in

[src/access-api.ts:700](https://github.com/hjdhjd/unifi-access/blob/e0dcb0f/src/access-api.ts#L700)

___

### getMaxListeners

▸ **getMaxListeners**(): `number`

Returns the current max listener value for the `EventEmitter` which is either
set by `emitter.setMaxListeners(n)` or defaults to [defaultMaxListeners](AccessApi.md#defaultmaxlisteners).

#### Returns

`number`

**`Since`**

v1.0.0

#### Inherited from

EventEmitter.getMaxListeners

#### Defined in

node_modules/@types/node/events.d.ts:735

___

### listenerCount

▸ **listenerCount**\<`K`\>(`eventName`, `listener?`): `number`

Returns the number of listeners listening for the event named `eventName`.
If `listener` is provided, it will return how many times the listener is found
in the list of the listeners of the event.

#### Type parameters

| Name |
| :------ |
| `K` |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `eventName` | `string` \| `symbol` | The name of the event being listened for |
| `listener?` | `Function` | The event handler function |

#### Returns

`number`

**`Since`**

v3.2.0

#### Inherited from

EventEmitter.listenerCount

#### Defined in

node_modules/@types/node/events.d.ts:829

___

### listeners

▸ **listeners**\<`K`\>(`eventName`): `Function`[]

Returns a copy of the array of listeners for the event named `eventName`.

```js
server.on('connection', (stream) => {
  console.log('someone connected!');
});
console.log(util.inspect(server.listeners('connection')));
// Prints: [ [Function] ]
```

#### Type parameters

| Name |
| :------ |
| `K` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `eventName` | `string` \| `symbol` |

#### Returns

`Function`[]

**`Since`**

v0.1.26

#### Inherited from

EventEmitter.listeners

#### Defined in

node_modules/@types/node/events.d.ts:748

___

### login

▸ **login**(`address`, `username`, `password`): `Promise`\<`boolean`\>

Execute a login attempt to the UniFi Access API.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `address` | `string` | Address of the UniFi Access controller, expressed as an FQDN or IP address. |
| `username` | `string` | Username to use when logging into the controller. |
| `password` | `string` | Password to use when logging into the controller. |

#### Returns

`Promise`\<`boolean`\>

Returns a promise that will resolve to `true` if successful and `false` otherwise.

**`Remarks`**

A `login` event will be emitted each time this method is called, with the result of the attempt as an argument.

**`Example`**

Login to the Access controller. You can selectively choose to either `await` the promise that is returned by `login`, or subscribe to the `login` event.

```ts
import { AccessApi } from "unifi-access";

// Create a new Access API instance.
const ufp = new AccessApi();

// Set a listener to wait for the login event to occur.
ufp.once("login", (successfulLogin: boolean) => {

  // Indicate if we are successful.
  if(successfulLogin) {

    console.log("Logged in successfully.");
    process.exit(0);
  }
});

// Login to the Access controller.
if(!(await ufa.login("access-controller.local", "username", "password"))) {

  console.log("Invalid login credentials.");
  process.exit(0);
};
```

#### Defined in

[src/access-api.ts:152](https://github.com/hjdhjd/unifi-access/blob/e0dcb0f/src/access-api.ts#L152)

___

### logout

▸ **logout**(): `void`

Clear the login credentials and terminate any open connection to the UniFi Access API.

#### Returns

`void`

#### Defined in

[src/access-api.ts:733](https://github.com/hjdhjd/unifi-access/blob/e0dcb0f/src/access-api.ts#L733)

___

### off

▸ **off**\<`K`\>(`eventName`, `listener`): `this`

Alias for `emitter.removeListener()`.

#### Type parameters

| Name |
| :------ |
| `K` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `eventName` | `string` \| `symbol` |
| `listener` | (...`args`: `any`[]) => `void` |

#### Returns

`this`

**`Since`**

v10.0.0

#### Inherited from

EventEmitter.off

#### Defined in

node_modules/@types/node/events.d.ts:708

___

### on

▸ **on**\<`K`\>(`eventName`, `listener`): `this`

Adds the `listener` function to the end of the listeners array for the
event named `eventName`. No checks are made to see if the `listener` has
already been added. Multiple calls passing the same combination of `eventName`and `listener` will result in the `listener` being added, and called, multiple
times.

```js
server.on('connection', (stream) => {
  console.log('someone connected!');
});
```

Returns a reference to the `EventEmitter`, so that calls can be chained.

By default, event listeners are invoked in the order they are added. The`emitter.prependListener()` method can be used as an alternative to add the
event listener to the beginning of the listeners array.

```js
import { EventEmitter } from 'node:events';
const myEE = new EventEmitter();
myEE.on('foo', () => console.log('a'));
myEE.prependListener('foo', () => console.log('b'));
myEE.emit('foo');
// Prints:
//   b
//   a
```

#### Type parameters

| Name |
| :------ |
| `K` |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `eventName` | `string` \| `symbol` | The name of the event. |
| `listener` | (...`args`: `any`[]) => `void` | The callback function |

#### Returns

`this`

**`Since`**

v0.1.101

#### Inherited from

EventEmitter.on

#### Defined in

node_modules/@types/node/events.d.ts:590

___

### once

▸ **once**\<`K`\>(`eventName`, `listener`): `this`

Adds a **one-time**`listener` function for the event named `eventName`. The
next time `eventName` is triggered, this listener is removed and then invoked.

```js
server.once('connection', (stream) => {
  console.log('Ah, we have our first user!');
});
```

Returns a reference to the `EventEmitter`, so that calls can be chained.

By default, event listeners are invoked in the order they are added. The`emitter.prependOnceListener()` method can be used as an alternative to add the
event listener to the beginning of the listeners array.

```js
import { EventEmitter } from 'node:events';
const myEE = new EventEmitter();
myEE.once('foo', () => console.log('a'));
myEE.prependOnceListener('foo', () => console.log('b'));
myEE.emit('foo');
// Prints:
//   b
//   a
```

#### Type parameters

| Name |
| :------ |
| `K` |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `eventName` | `string` \| `symbol` | The name of the event. |
| `listener` | (...`args`: `any`[]) => `void` | The callback function |

#### Returns

`this`

**`Since`**

v0.3.0

#### Inherited from

EventEmitter.once

#### Defined in

node_modules/@types/node/events.d.ts:620

___

### prependListener

▸ **prependListener**\<`K`\>(`eventName`, `listener`): `this`

Adds the `listener` function to the _beginning_ of the listeners array for the
event named `eventName`. No checks are made to see if the `listener` has
already been added. Multiple calls passing the same combination of `eventName`and `listener` will result in the `listener` being added, and called, multiple
times.

```js
server.prependListener('connection', (stream) => {
  console.log('someone connected!');
});
```

Returns a reference to the `EventEmitter`, so that calls can be chained.

#### Type parameters

| Name |
| :------ |
| `K` |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `eventName` | `string` \| `symbol` | The name of the event. |
| `listener` | (...`args`: `any`[]) => `void` | The callback function |

#### Returns

`this`

**`Since`**

v6.0.0

#### Inherited from

EventEmitter.prependListener

#### Defined in

node_modules/@types/node/events.d.ts:847

___

### prependOnceListener

▸ **prependOnceListener**\<`K`\>(`eventName`, `listener`): `this`

Adds a **one-time**`listener` function for the event named `eventName` to the _beginning_ of the listeners array. The next time `eventName` is triggered, this
listener is removed, and then invoked.

```js
server.prependOnceListener('connection', (stream) => {
  console.log('Ah, we have our first user!');
});
```

Returns a reference to the `EventEmitter`, so that calls can be chained.

#### Type parameters

| Name |
| :------ |
| `K` |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `eventName` | `string` \| `symbol` | The name of the event. |
| `listener` | (...`args`: `any`[]) => `void` | The callback function |

#### Returns

`this`

**`Since`**

v6.0.0

#### Inherited from

EventEmitter.prependOnceListener

#### Defined in

node_modules/@types/node/events.d.ts:863

___

### rawListeners

▸ **rawListeners**\<`K`\>(`eventName`): `Function`[]

Returns a copy of the array of listeners for the event named `eventName`,
including any wrappers (such as those created by `.once()`).

```js
import { EventEmitter } from 'node:events';
const emitter = new EventEmitter();
emitter.once('log', () => console.log('log once'));

// Returns a new Array with a function `onceWrapper` which has a property
// `listener` which contains the original listener bound above
const listeners = emitter.rawListeners('log');
const logFnWrapper = listeners[0];

// Logs "log once" to the console and does not unbind the `once` event
logFnWrapper.listener();

// Logs "log once" to the console and removes the listener
logFnWrapper();

emitter.on('log', () => console.log('log persistently'));
// Will return a new Array with a single function bound by `.on()` above
const newListeners = emitter.rawListeners('log');

// Logs "log persistently" twice
newListeners[0]();
emitter.emit('log');
```

#### Type parameters

| Name |
| :------ |
| `K` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `eventName` | `string` \| `symbol` |

#### Returns

`Function`[]

**`Since`**

v9.4.0

#### Inherited from

EventEmitter.rawListeners

#### Defined in

node_modules/@types/node/events.d.ts:779

___

### removeAllListeners

▸ **removeAllListeners**(`eventName?`): `this`

Removes all listeners, or those of the specified `eventName`.

It is bad practice to remove listeners added elsewhere in the code,
particularly when the `EventEmitter` instance was created by some other
component or module (e.g. sockets or file streams).

Returns a reference to the `EventEmitter`, so that calls can be chained.

#### Parameters

| Name | Type |
| :------ | :------ |
| `eventName?` | `string` \| `symbol` |

#### Returns

`this`

**`Since`**

v0.1.26

#### Inherited from

EventEmitter.removeAllListeners

#### Defined in

node_modules/@types/node/events.d.ts:719

___

### removeListener

▸ **removeListener**\<`K`\>(`eventName`, `listener`): `this`

Removes the specified `listener` from the listener array for the event named`eventName`.

```js
const callback = (stream) => {
  console.log('someone connected!');
};
server.on('connection', callback);
// ...
server.removeListener('connection', callback);
```

`removeListener()` will remove, at most, one instance of a listener from the
listener array. If any single listener has been added multiple times to the
listener array for the specified `eventName`, then `removeListener()` must be
called multiple times to remove each instance.

Once an event is emitted, all listeners attached to it at the
time of emitting are called in order. This implies that any`removeListener()` or `removeAllListeners()` calls _after_ emitting and _before_ the last listener finishes execution
will not remove them from`emit()` in progress. Subsequent events behave as expected.

```js
import { EventEmitter } from 'node:events';
class MyEmitter extends EventEmitter {}
const myEmitter = new MyEmitter();

const callbackA = () => {
  console.log('A');
  myEmitter.removeListener('event', callbackB);
};

const callbackB = () => {
  console.log('B');
};

myEmitter.on('event', callbackA);

myEmitter.on('event', callbackB);

// callbackA removes listener callbackB but it will still be called.
// Internal listener array at time of emit [callbackA, callbackB]
myEmitter.emit('event');
// Prints:
//   A
//   B

// callbackB is now removed.
// Internal listener array [callbackA]
myEmitter.emit('event');
// Prints:
//   A
```

Because listeners are managed using an internal array, calling this will
change the position indices of any listener registered _after_ the listener
being removed. This will not impact the order in which listeners are called,
but it means that any copies of the listener array as returned by
the `emitter.listeners()` method will need to be recreated.

When a single function has been added as a handler multiple times for a single
event (as in the example below), `removeListener()` will remove the most
recently added instance. In the example the `once('ping')`listener is removed:

```js
import { EventEmitter } from 'node:events';
const ee = new EventEmitter();

function pong() {
  console.log('pong');
}

ee.on('ping', pong);
ee.once('ping', pong);
ee.removeListener('ping', pong);

ee.emit('ping');
ee.emit('ping');
```

Returns a reference to the `EventEmitter`, so that calls can be chained.

#### Type parameters

| Name |
| :------ |
| `K` |

#### Parameters

| Name | Type |
| :------ | :------ |
| `eventName` | `string` \| `symbol` |
| `listener` | (...`args`: `any`[]) => `void` |

#### Returns

`this`

**`Since`**

v0.1.26

#### Inherited from

EventEmitter.removeListener

#### Defined in

node_modules/@types/node/events.d.ts:703

___

### reset

▸ **reset**(): `void`

Terminate any open connection to the UniFi Access API.

#### Returns

`void`

#### Defined in

[src/access-api.ts:712](https://github.com/hjdhjd/unifi-access/blob/e0dcb0f/src/access-api.ts#L712)

___

### retrieve

▸ **retrieve**(`url`, `options?`, `logErrors?`): `Promise`\<``null`` \| `Response`\>

Execute an HTTP fetch request to the Access controller.

#### Parameters

| Name | Type | Default value | Description |
| :------ | :------ | :------ | :------ |
| `url` | `string` | `undefined` | Requested endpoint type. Valid types are `livestream` and `talkback`. |
| `options` | `RequestOptions` | `undefined` | Parameters to pass on for the endpoint request. |
| `logErrors` | `boolean` | `true` | Log errors that aren't already accounted for and handled, rather than failing silently. Defaults to `true`. |

#### Returns

`Promise`\<``null`` \| `Response`\>

Returns a promise that will resolve to a Response object successful, and `null` otherwise.

**`Remarks`**

This method should be used when direct access to the Access controller is needed, or when this library doesn't have a needed method to access
  controller capabilities.

#### Defined in

[src/access-api.ts:768](https://github.com/hjdhjd/unifi-access/blob/e0dcb0f/src/access-api.ts#L768)

___

### setMaxListeners

▸ **setMaxListeners**(`n`): `this`

By default `EventEmitter`s will print a warning if more than `10` listeners are
added for a particular event. This is a useful default that helps finding
memory leaks. The `emitter.setMaxListeners()` method allows the limit to be
modified for this specific `EventEmitter` instance. The value can be set to`Infinity` (or `0`) to indicate an unlimited number of listeners.

Returns a reference to the `EventEmitter`, so that calls can be chained.

#### Parameters

| Name | Type |
| :------ | :------ |
| `n` | `number` |

#### Returns

`this`

**`Since`**

v0.3.5

#### Inherited from

EventEmitter.setMaxListeners

#### Defined in

node_modules/@types/node/events.d.ts:729

___

### unlock

▸ **unlock**(`device`, `duration?`): `Promise`\<`boolean`\>

Send an unlock command to the Access controller.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `device` | `Readonly`\<[`AccessDeviceConfigInterface`](../interfaces/AccessDeviceConfigInterface.md)\> | Access device. |
| `duration?` | `number` | Unlock interval in minutes. |

#### Returns

`Promise`\<`boolean`\>

Returns `true` if successful, `false` otherwise.

**`Remarks`**

If `duration` is not specified, a standard unlock request will be sent to the Access controller which will unlock for 2 seconds. Valid values for duration
are `Infinity` - remain unlocked until reset, `0` - reset lock to secure state, `duration` - number of minutes.

#### Defined in

[src/access-api.ts:532](https://github.com/hjdhjd/unifi-access/blob/e0dcb0f/src/access-api.ts#L532)

___

### updateDevice

▸ **updateDevice**\<`DeviceType`\>(`device`, `payload`): `Promise`\<``null`` \| `DeviceType`\>

Update an Access device's configuration on the UniFi Access controller.

#### Type parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `DeviceType` | extends `Readonly`\<[`AccessDeviceConfigInterface`](../interfaces/AccessDeviceConfigInterface.md)\> | Generic for any known Access device type. |

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `device` | `DeviceType` | Access device. |
| `payload` | `DeepPartial`\<[`AccessDeviceConfigInterface`](../interfaces/AccessDeviceConfigInterface.md)\> | Device configuration payload to upload, usually a subset of the device-specific configuration JSON. |

#### Returns

`Promise`\<``null`` \| `DeviceType`\>

Returns a promise that will resolve to the updated device-specific configuration JSON if successful, and `null` otherwise.

**`Remarks`**

Use this method to change the configuration of a given Access device or controller. It requires the credentials used to login to the Access API
  to have administrative privileges for most settings.

#### Defined in

[src/access-api.ts:623](https://github.com/hjdhjd/unifi-access/blob/e0dcb0f/src/access-api.ts#L623)

___

### addAbortListener

▸ **addAbortListener**(`signal`, `resource`): `Disposable`

Listens once to the `abort` event on the provided `signal`.

Listening to the `abort` event on abort signals is unsafe and may
lead to resource leaks since another third party with the signal can
call `e.stopImmediatePropagation()`. Unfortunately Node.js cannot change
this since it would violate the web standard. Additionally, the original
API makes it easy to forget to remove listeners.

This API allows safely using `AbortSignal`s in Node.js APIs by solving these
two issues by listening to the event such that `stopImmediatePropagation` does
not prevent the listener from running.

Returns a disposable so that it may be unsubscribed from more easily.

```js
import { addAbortListener } from 'node:events';

function example(signal) {
  let disposable;
  try {
    signal.addEventListener('abort', (e) => e.stopImmediatePropagation());
    disposable = addAbortListener(signal, (e) => {
      // Do something when signal is aborted.
    });
  } finally {
    disposable?.[Symbol.dispose]();
  }
}
```

#### Parameters

| Name | Type |
| :------ | :------ |
| `signal` | `AbortSignal` |
| `resource` | (`event`: `Event`) => `void` |

#### Returns

`Disposable`

Disposable that removes the `abort` listener.

**`Since`**

v20.5.0

#### Inherited from

EventEmitter.addAbortListener

#### Defined in

node_modules/@types/node/events.d.ts:400

___

### getEventListeners

▸ **getEventListeners**(`emitter`, `name`): `Function`[]

Returns a copy of the array of listeners for the event named `eventName`.

For `EventEmitter`s this behaves exactly the same as calling `.listeners` on
the emitter.

For `EventTarget`s this is the only way to get the event listeners for the
event target. This is useful for debugging and diagnostic purposes.

```js
import { getEventListeners, EventEmitter } from 'node:events';

{
  const ee = new EventEmitter();
  const listener = () => console.log('Events are fun');
  ee.on('foo', listener);
  console.log(getEventListeners(ee, 'foo')); // [ [Function: listener] ]
}
{
  const et = new EventTarget();
  const listener = () => console.log('Events are fun');
  et.addEventListener('foo', listener);
  console.log(getEventListeners(et, 'foo')); // [ [Function: listener] ]
}
```

#### Parameters

| Name | Type |
| :------ | :------ |
| `emitter` | `EventEmitter`\<`DefaultEventMap`\> \| `_DOMEventTarget` |
| `name` | `string` \| `symbol` |

#### Returns

`Function`[]

**`Since`**

v15.2.0, v14.17.0

#### Inherited from

EventEmitter.getEventListeners

#### Defined in

node_modules/@types/node/events.d.ts:321

___

### getMaxListeners

▸ **getMaxListeners**(`emitter`): `number`

Returns the currently set max amount of listeners.

For `EventEmitter`s this behaves exactly the same as calling `.getMaxListeners` on
the emitter.

For `EventTarget`s this is the only way to get the max event listeners for the
event target. If the number of event handlers on a single EventTarget exceeds
the max set, the EventTarget will print a warning.

```js
import { getMaxListeners, setMaxListeners, EventEmitter } from 'node:events';

{
  const ee = new EventEmitter();
  console.log(getMaxListeners(ee)); // 10
  setMaxListeners(11, ee);
  console.log(getMaxListeners(ee)); // 11
}
{
  const et = new EventTarget();
  console.log(getMaxListeners(et)); // 10
  setMaxListeners(11, et);
  console.log(getMaxListeners(et)); // 11
}
```

#### Parameters

| Name | Type |
| :------ | :------ |
| `emitter` | `EventEmitter`\<`DefaultEventMap`\> \| `_DOMEventTarget` |

#### Returns

`number`

**`Since`**

v19.9.0

#### Inherited from

EventEmitter.getMaxListeners

#### Defined in

node_modules/@types/node/events.d.ts:350

___

### listenerCount

▸ **listenerCount**(`emitter`, `eventName`): `number`

A class method that returns the number of listeners for the given `eventName`registered on the given `emitter`.

```js
import { EventEmitter, listenerCount } from 'node:events';

const myEmitter = new EventEmitter();
myEmitter.on('event', () => {});
myEmitter.on('event', () => {});
console.log(listenerCount(myEmitter, 'event'));
// Prints: 2
```

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `emitter` | `EventEmitter`\<`DefaultEventMap`\> | The emitter to query |
| `eventName` | `string` \| `symbol` | The event name |

#### Returns

`number`

**`Since`**

v0.9.12

**`Deprecated`**

Since v3.2.0 - Use `listenerCount` instead.

#### Inherited from

EventEmitter.listenerCount

#### Defined in

node_modules/@types/node/events.d.ts:293

___

### on

▸ **on**(`emitter`, `eventName`, `options?`): `AsyncIterableIterator`\<`any`\>

```js
import { on, EventEmitter } from 'node:events';
import process from 'node:process';

const ee = new EventEmitter();

// Emit later on
process.nextTick(() => {
  ee.emit('foo', 'bar');
  ee.emit('foo', 42);
});

for await (const event of on(ee, 'foo')) {
  // The execution of this inner block is synchronous and it
  // processes one event at a time (even with await). Do not use
  // if concurrent execution is required.
  console.log(event); // prints ['bar'] [42]
}
// Unreachable here
```

Returns an `AsyncIterator` that iterates `eventName` events. It will throw
if the `EventEmitter` emits `'error'`. It removes all listeners when
exiting the loop. The `value` returned by each iteration is an array
composed of the emitted event arguments.

An `AbortSignal` can be used to cancel waiting on events:

```js
import { on, EventEmitter } from 'node:events';
import process from 'node:process';

const ac = new AbortController();

(async () => {
  const ee = new EventEmitter();

  // Emit later on
  process.nextTick(() => {
    ee.emit('foo', 'bar');
    ee.emit('foo', 42);
  });

  for await (const event of on(ee, 'foo', { signal: ac.signal })) {
    // The execution of this inner block is synchronous and it
    // processes one event at a time (even with await). Do not use
    // if concurrent execution is required.
    console.log(event); // prints ['bar'] [42]
  }
  // Unreachable here
})();

process.nextTick(() => ac.abort());
```

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `emitter` | `EventEmitter`\<`DefaultEventMap`\> | - |
| `eventName` | `string` | The name of the event being listened for |
| `options?` | `StaticEventEmitterOptions` | - |

#### Returns

`AsyncIterableIterator`\<`any`\>

that iterates `eventName` events emitted by the `emitter`

**`Since`**

v13.6.0, v12.16.0

#### Inherited from

EventEmitter.on

#### Defined in

node_modules/@types/node/events.d.ts:271

___

### once

▸ **once**(`emitter`, `eventName`, `options?`): `Promise`\<`any`[]\>

Creates a `Promise` that is fulfilled when the `EventEmitter` emits the given
event or that is rejected if the `EventEmitter` emits `'error'` while waiting.
The `Promise` will resolve with an array of all the arguments emitted to the
given event.

This method is intentionally generic and works with the web platform [EventTarget](https://dom.spec.whatwg.org/#interface-eventtarget) interface, which has no special`'error'` event
semantics and does not listen to the `'error'` event.

```js
import { once, EventEmitter } from 'node:events';
import process from 'node:process';

const ee = new EventEmitter();

process.nextTick(() => {
  ee.emit('myevent', 42);
});

const [value] = await once(ee, 'myevent');
console.log(value);

const err = new Error('kaboom');
process.nextTick(() => {
  ee.emit('error', err);
});

try {
  await once(ee, 'myevent');
} catch (err) {
  console.error('error happened', err);
}
```

The special handling of the `'error'` event is only used when `events.once()`is used to wait for another event. If `events.once()` is used to wait for the
'`error'` event itself, then it is treated as any other kind of event without
special handling:

```js
import { EventEmitter, once } from 'node:events';

const ee = new EventEmitter();

once(ee, 'error')
  .then(([err]) => console.log('ok', err.message))
  .catch((err) => console.error('error', err.message));

ee.emit('error', new Error('boom'));

// Prints: ok boom
```

An `AbortSignal` can be used to cancel waiting for the event:

```js
import { EventEmitter, once } from 'node:events';

const ee = new EventEmitter();
const ac = new AbortController();

async function foo(emitter, event, signal) {
  try {
    await once(emitter, event, { signal });
    console.log('event emitted!');
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('Waiting for the event was canceled!');
    } else {
      console.error('There was an error', error.message);
    }
  }
}

foo(ee, 'foo', ac.signal);
ac.abort(); // Abort waiting for the event
ee.emit('foo'); // Prints: Waiting for the event was canceled!
```

#### Parameters

| Name | Type |
| :------ | :------ |
| `emitter` | `EventEmitter`\<`DefaultEventMap`\> |
| `eventName` | `string` \| `symbol` |
| `options?` | `StaticEventEmitterOptions` |

#### Returns

`Promise`\<`any`[]\>

**`Since`**

v11.13.0, v10.16.0

#### Inherited from

EventEmitter.once

#### Defined in

node_modules/@types/node/events.d.ts:206

▸ **once**(`emitter`, `eventName`, `options?`): `Promise`\<`any`[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `emitter` | `_DOMEventTarget` |
| `eventName` | `string` |
| `options?` | `StaticEventEmitterOptions` |

#### Returns

`Promise`\<`any`[]\>

#### Inherited from

EventEmitter.once

#### Defined in

node_modules/@types/node/events.d.ts:211

___

### setMaxListeners

▸ **setMaxListeners**(`n?`, `...eventTargets`): `void`

```js
import { setMaxListeners, EventEmitter } from 'node:events';

const target = new EventTarget();
const emitter = new EventEmitter();

setMaxListeners(5, target, emitter);
```

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `n?` | `number` | A non-negative number. The maximum number of listeners per `EventTarget` event. |
| `...eventTargets` | (`EventEmitter`\<`DefaultEventMap`\> \| `_DOMEventTarget`)[] | - |

#### Returns

`void`

**`Since`**

v15.4.0

#### Inherited from

EventEmitter.setMaxListeners

#### Defined in

node_modules/@types/node/events.d.ts:365
