[**unifi-access**](../README.md)

***

[Home](../README.md) / OfficialWebhooks

# Interface: OfficialWebhooks

The official API's webhook administration: the endpoints the controller delivers to.

This is the registration half of the webhook domain; the delivery shapes above and [verifyWebhookSignature](../functions/verifyWebhookSignature.md) are what a consumer uses once deliveries start
arriving at whatever it registered.

## Methods

### createEndpoint()

```ts
createEndpoint(opts, call?): Promise<AccessOfficialWebhookEndpoint>;
```

Register a webhook endpoint. `POST /webhooks/endpoints`, permission `edit:webhook`. Requires UniFi Access 2.2.10 or later.

The controller mints the endpoint's signing secret here and returns it on this response. It is also readable afterwards, so it does not have to be captured
from this call alone.

Live-verified.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `opts` | [`AccessOfficialWebhookEndpointWrite`](AccessOfficialWebhookEndpointWrite.md) | The endpoint to register and the events to send it. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<[`AccessOfficialWebhookEndpoint`](AccessOfficialWebhookEndpoint.md)\>

The registered endpoint, including its minted secret.

***

### deleteEndpoint()

```ts
deleteEndpoint(id, call?): Promise<void>;
```

Unregister a webhook endpoint. `DELETE /webhooks/endpoints/:id`, permission `edit:webhook`. Requires UniFi Access 2.2.10 or later.

Live-verified.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `string` | The endpoint's identifier. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<`void`\>

***

### fetchAllEndpoints()

```ts
fetchAllEndpoints(call?): Promise<AccessOfficialWebhookEndpoint[]>;
```

Fetch every registered webhook endpoint. `GET /webhooks/endpoints`, permission `view:webhook`. Requires UniFi Access 2.2.10 or later.

Live-verified.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<[`AccessOfficialWebhookEndpoint`](AccessOfficialWebhookEndpoint.md)[]\>

Every registered endpoint, each with its secret.

***

### updateEndpoint()

```ts
updateEndpoint(
   id, 
   opts, 
   call?
): Promise<AccessOfficialWebhookEndpoint>;
```

Replace a registered webhook endpoint. `PUT /webhooks/endpoints/:id`, permission `edit:webhook`. Requires UniFi Access 2.2.10 or later.

Documentation-derived.

#### Parameters

| Parameter | Type | Description |
| ------ | ------ | ------ |
| `id` | `string` | The endpoint's identifier. |
| `opts` | [`AccessOfficialWebhookEndpointWrite`](AccessOfficialWebhookEndpointWrite.md) | The full record to replace it with. |
| `call` | [`AccessOfficialCallOptions`](AccessOfficialCallOptions.md) | The per-call options - an optional abort signal. |

#### Returns

`Promise`\<[`AccessOfficialWebhookEndpoint`](AccessOfficialWebhookEndpoint.md)\>

The updated endpoint.
