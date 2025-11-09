[**unifi-access**](README.md)

***

[Home](README.md) / access-api

# access-api

## Classes

### AccessApi

The direct UniFi Access API is partially documented through an officially supported public API that Ubiquiti has released. However, this API also has certain
constraints and limitations such as lacking the ability to change the settings on an Access device. The full native API has been reverse engineered mostly through
trail and error with the Access web interface as well as insight from the public API.

Here's how the UniFi Access API works:

1. [Login](#login) to the UniFi Access controller and acquire security credentials for further calls to the API.

2. Enumerate the list of UniFi Access devices by calling the [bootstrap](#bootstrap) property. This contains everything you would want to know about the devices attached to
   this particular UniFi Access controller. Information about the Access controller can be accessed through the [controller](#controller) property.

3. Listen for `message` events emitted by [AccessApi](#accessapi) containing all Access controller events, in realtime. They are delivered as
   [access-types.AccessEventPacket](access-types.md#accesseventpacket) packets, containing the event-specific details.

Those are the basics that gets us up and running.

#### Extends

- `EventEmitter`

#### Constructors

##### Constructor

```ts
new AccessApi(log?): AccessApi;
```

Create an instance of the UniFi Access API.

###### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `log?` | [`AccessLogging`](access-logging.md#accesslogging) | Logging functions to use. |

###### Returns

[`AccessApi`](#accessapi)

###### Default Value

`none` - Logging will be done to stdout and stderr.

###### Overrides

```ts
EventEmitter.constructor
```

#### Utilities

##### isThrottled

###### Get Signature

```ts
get isThrottled(): boolean;
```

Utility method that returns whether our connection to the Access controller is currently throttled or not.

###### Returns

`boolean`

Returns `true` if the API has returned too many errors and is now throttled for a period of time, `false` otherwise.

#### Other

##### bootstrap

###### Get Signature

```ts
get bootstrap(): Nullable<Readonly<AccessBootstrapConfigInterface>>;
```

Access the Access controller bootstrap JSON.

###### Returns

`Nullable`\<`Readonly`\<[`AccessBootstrapConfigInterface`](access-types.md#accessbootstrapconfiginterface)\>\>

Returns the bootstrap JSON if the Access controller has been bootstrapped, `null` otherwise.

##### controller

###### Get Signature

```ts
get controller(): Nullable<Readonly<AccessControllerConfigInterface>>;
```

Access the Access controller information JSON.

###### Returns

`Nullable`\<`Readonly`\<[`AccessControllerConfigInterface`](access-types.md#accesscontrollerconfiginterface)\>\>

Returns the controller information JSON if the Access controller has been bootstrapped, `null` otherwise.

##### devices

###### Get Signature

```ts
get devices(): Nullable<Readonly<AccessDeviceConfigInterface>[]>;
```

Access the Access controller list of devices.

###### Returns

`Nullable`\<`Readonly`\<[`AccessDeviceConfigInterface`](access-types.md#accessdeviceconfiginterface)\>[]\>

Returns an array of all the devices from all the UniFi Access hubs associated with this controller, `null` otherwise.

##### doors

###### Get Signature

```ts
get doors(): Nullable<Readonly<AccessDoorConfigInterface>[]>;
```

Access the Access controller list of doors.

###### Returns

`Nullable`\<`Readonly`\<[`AccessDoorConfigInterface`](access-types.md#accessdoorconfiginterface)\>[]\>

Returns an array of all the doors from all the UniFi Access hubs associated with this controller, `null` otherwise.

##### floors

###### Get Signature

```ts
get floors(): Nullable<Readonly<AccessFloorConfigInterface>[]>;
```

Access the Access controller list of floors.

###### Returns

`Nullable`\<`Readonly`\<[`AccessFloorConfigInterface`](access-types.md#accessfloorconfiginterface)\>[]\>

Returns an array of all the floors from all the UniFi Access hubs associated with this controller, `null` otherwise.

##### isAdminUser

###### Get Signature

```ts
get isAdminUser(): boolean;
```

Utility method that returns whether the credentials that were used to login to the Access controller have administrative privileges or not.

###### Returns

`boolean`

Returns `true` if the logged in user has administrative privileges, `false` otherwise.

##### name

###### Get Signature

```ts
get name(): string;
```

Utility method that returns a nicely formatted version of the Access controller name.

###### Returns

`string`

Returns the Access controller name in the following format:
  <code>*Access controller name* [*Access controller type*]</code>.

##### getApiEndpoint()

```ts
getApiEndpoint(endpoint): string;
```

Return an API endpoint for the requested endpoint type.

###### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `endpoint` | `string` | Requested endpoint type. |

###### Returns

`string`

Returns a URL to the requested endpoint if successful, and an empty string otherwise.

###### Remarks

Valid API endpoints are `bootstrap`, `device`, `login`, `self`, and `websocket`.

##### getBootstrap()

```ts
getBootstrap(): Promise<boolean>;
```

Retrieve the bootstrap JSON from a UniFi Access controller.

###### Returns

`Promise`\<`boolean`\>

Returns a promise that will resolve to `true` if successful and `false` otherwise.

###### Remarks

A `bootstrap` event will be emitted each time this method is successfully called, with the AccessToplogyConfig JSON as an argument. As a
convenience, the [devices](#devices), [doors](#doors), and [floors](#floors) properties will be populated as well.

###### Example

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

Alternatively, you can access the bootstrap JSON directly through the [bootstrap](#bootstrap) accessor:

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

##### getDeviceName()

```ts
getDeviceName(
   device, 
   name, 
   deviceInfo): string;
```

Utility method that generates a nicely formatted device information string.

###### Parameters

| Parameter | Type | Default value | Description |
| ------ | ------ | ------ | ------ |
| `device` | [`AccessDeviceConfig`](access-types.md#accessdeviceconfig) | `undefined` | Access device. |
| `name` | `string` \| `undefined` | `...` | Optional name for the device. Defaults to the device type (e.g. `UA G2 Pro Black`). |
| `deviceInfo` | `boolean` | `false` | Optionally specify whether or not to include the IP address and MAC address in the returned string. Defaults to `false`. |

###### Returns

`string`

Returns the Access device name in the following format: <code>*Access device name* [*Access device type*] (address: *IP address* mac: *MAC address*)</code>.

###### Remarks

The example above assumed the `deviceInfo` parameter is set to `true`.

##### getFullName()

```ts
getFullName(device): string;
```

Utility method that generates a combined, nicely formatted device and controller string.

###### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `device` | [`AccessDeviceConfig`](access-types.md#accessdeviceconfig) | Access device. |

###### Returns

`string`

Returns the Access device name in the following format:
  <code>*Access controller name* [*Access controller type*] *Access device name* [*Access device type*]</code>.

##### login()

```ts
login(
   address, 
   username, 
password): Promise<boolean>;
```

Execute a login attempt to the UniFi Access API.

###### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `address` | `string` | Address of the UniFi Access controller, expressed as an FQDN or IP address. |
| `username` | `string` | Username to use when logging into the controller. |
| `password` | `string` | Password to use when logging into the controller. |

###### Returns

`Promise`\<`boolean`\>

Returns a promise that will resolve to `true` if successful and `false` otherwise.

###### Remarks

A `login` event will be emitted each time this method is called, with the result of the attempt as an argument.

###### Example

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

##### logout()

```ts
logout(): void;
```

Clear the login credentials and terminate any open connection to the UniFi Access API.

###### Returns

`void`

##### reset()

```ts
reset(): void;
```

Terminate any open connection to the UniFi Access API.

###### Returns

`void`

##### responseOk()

```ts
responseOk(code?): boolean;
```

###### Parameters

| Parameter | Type |
| ------ | ------ |
| `code?` | `number` |

###### Returns

`boolean`

##### retrieve()

```ts
retrieve(
   url, 
   options, 
retrieveOptions): Promise<Nullable<ResponseData<unknown>>>;
```

Execute an HTTP fetch request to the Access controller.

###### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `url` | `string` | Full URL to request (e.g., `https://192.168.1.1/proxy/access/api/v2/devices/topologyv4`) |
| `options` | [`RequestOptions`](#requestoptions) | Parameters to pass on for the endpoint request. |
| `retrieveOptions` | [`RetrieveOptions`](#retrieveoptions) | Additional options for error handling and timeouts |

###### Returns

`Promise`\<`Nullable`\<`ResponseData`\<`unknown`\>\>\>

Promise resolving to the Response object, or `null` on failure.

###### Remarks

This method provides direct access to the Protect controller API for advanced use cases not covered by the built-in methods. It handles:

- Authentication and session management
- Automatic retry with exponential backoff
- Error logging and throttling
- CSRF token management

The `options` parameter extends [Undici's RequestOptions](https://undici.nodejs.org/#/docs/api/Dispatcher.md?id=parameter-requestoptions), providing full control
over the HTTP request.

##### unlock()

```ts
unlock(device, duration?): Promise<boolean>;
```

Send an unlock command to the Access controller.

###### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `device` | [`AccessDeviceConfig`](access-types.md#accessdeviceconfig) | Access device. |
| `duration?` | `number` | Unlock interval in minutes. |

###### Returns

`Promise`\<`boolean`\>

Returns `true` if successful, `false` otherwise.

###### Remarks

If `duration` is not specified, a standard unlock request will be sent to the Access controller which will unlock for 2 seconds. Valid values for duration
are `Infinity` - remain unlocked until reset, `0` - reset lock to secure state, `duration` - number of minutes.

##### updateDevice()

```ts
updateDevice<DeviceType>(device, payload): Promise<Nullable<DeviceType>>;
```

Update an Access device's configuration on the UniFi Access controller.

###### Type Parameters

| Type Parameter | Description |
| ------ | ------ |
| `DeviceType` *extends* `Readonly`\<[`AccessDeviceConfigInterface`](access-types.md#accessdeviceconfiginterface)\> | Generic for any known Access device type. |

###### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `device` | `DeviceType` | Access device. |
| `payload` | [`AccessDeviceConfigPayload`](access-types.md#accessdeviceconfigpayload) | Device configuration payload to upload, usually a subset of the device-specific configuration JSON. |

###### Returns

`Promise`\<`Nullable`\<`DeviceType`\>\>

Returns a promise that will resolve to the updated device-specific configuration JSON if successful, and `null` otherwise.

###### Remarks

Use this method to change the configuration of a given Access device or controller. It requires the credentials used to login to the Access API
  to have administrative privileges for most settings.

## Interfaces

### RetrieveOptions

Options to tailor the behavior of [AccessApi.retrieve](#retrieve).

#### Properties

| Property | Type | Description |
| ------ | ------ | ------ |
| <a id="logerrors"></a> `logErrors?` | `boolean` | Log errors. Defaults to `true`. |
| <a id="timeout"></a> `timeout?` | `number` | Amount of time, in milliseconds, to wait for the Access controller to respond before timing out. Defaults to `3500`. |

## Type Aliases

### RequestOptions

```ts
type RequestOptions = {
  dispatcher?: Dispatcher;
} & Omit<Dispatcher.RequestOptions, "origin" | "path">;
```

#### Type Declaration

| Name | Type |
| ------ | ------ |
| `dispatcher?` | `Dispatcher` |
