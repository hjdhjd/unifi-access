/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * port-bindings.ts: A hub's port-to-door bindings - which extensions of a device record are one, which door each of them binds, and the port it belongs to.
 */

/**
 * The single home of which extensions of a device record are a hub's port-to-door bindings, and of what one of those bindings says.
 *
 * A UniFi Access hub records which door each of its ports serves as an entry in its own record's extension list, alongside extensions that have nothing to do with ports
 * at all. More than one reader wants that list, and wants it to mean the same thing to each of them: the hub projection's door-identity getter, which answers the door a
 * handle commands; the state tier's access-point expansion, which presents each port of an Enterprise Access Hub as a device in its own right; and a consumer deciding
 * which of a multi-door hub's doors it cares about. Stating the rule once here is what keeps those readers from each carrying a copy of it.
 *
 * This is protocol-tier material for the same reason the terminal catalog is. The knowledge is about what the wire's values mean, it performs no I/O, and every
 * consumer sits above it. It is a sibling of that catalog rather than part of it because a hub's port-to-door map and what its screw terminals read are two
 * concepts: the catalog asks this module which extensions are port bindings so its duty selector reads the same ones, and asks it nothing else.
 *
 * The mechanism is all that lives here. Which binding of a multi-door hub is the one a consumer means - a gate's main door as against its side door - is policy
 * this library holds no opinion about, so the bindings are answered in the order the controller delivered them and nothing here ranks them.
 *
 * @module AccessPortBindings
 */

/**
 * The extension a hub binds one of its ports through. A hub records which door each of its ports serves under this name, with the door identity as the extension's
 * target and the port's own configuration - the terminal catalog's duty selector among it - in the entries beside it.
 *
 * It is published so that a consumer holding a raw device record can select on the same name this module does, rather than spelling the wire's string itself.
 *
 * @category Protocol
 */
export const PORT_EXTENSION = "port_setting";

/**
 * What the port-binding reads read off a device record.
 *
 * Declared structurally rather than as the stored device record, so this module depends on exactly the members it consults and takes no type edge to the reducer.
 * Each member serves one read. `extension_name` is what tells a port binding from every other extension kind a record can carry; `target_value` is the bound door's
 * identity; `target_name` is what the controller wrote beside it; and `source_id` names the port the binding belongs to. Both the wire's device record and the
 * reducer's stored form satisfy this.
 */
export interface AccessPortBindingSource {

  readonly extensions?: readonly {

    readonly extension_name: string;
    readonly source_id?: string;
    readonly target_name?: string;
    readonly target_value?: string;
  }[];
}

/**
 * One port-to-door binding: which door a hub's port is bound to, what the controller calls the thing at the other end of it, and which port it is.
 *
 * A member whose evidence is absent is ABSENT from the object rather than present and `undefined`, the rule the terminal facts hold to as well, so a consumer asking
 * whether a binding names its port asks whether the member is there at all.
 *
 * @category Protocol
 */
export interface AccessPortBinding {

  /** The bound door's identity, as the extension's `target_value` carries it. This is the member a command targets and a topology door is matched against. */
  readonly doorId: string;

  /**
   * The target's name exactly as the controller wrote it, from the extension's `target_name`. On every captured hub it is the bound door's own name, and a UA Gate
   * owner reported it carrying the gate operator's name instead, so it is passed through rather than interpreted. It is absent where the record carries none.
   */
  readonly name?: string;

  /**
   * The port this binding belongs to, from the extension's `source_id` - `port1` through `port8` on captured hardware. It is absent where the record carries none.
   */
  readonly port?: string;
}

/**
 * Every extension of a device record that is a port binding, in the order the controller delivered them.
 *
 * This is the one statement of which extensions are port bindings. The door-identity getter, the per-port access-point expansion, the terminal catalog's duty
 * selector, and the bindings read below all select through it, so none of them carries its own copy of the rule.
 *
 * It is generic over the element so a caller keeps whatever element type its own record declares: the access-point expansion spreads a whole extension onto the
 * record it synthesizes, and a narrowed element type would have thrown away the members that spread carries.
 *
 * It yields rather than answering a list because two of its readers want only the first extension: the door-identity getter, which runs on every command a hub
 * handle issues, and the terminal catalog's duty selector. Yielding lets those two stop at their answer without building a list they would take the head of,
 * while the readers that want the whole list build it themselves.
 *
 * @param device - Any device record (only its extensions are read).
 *
 * @returns Each port-binding extension of the record, in delivered order, yielded as it is met.
 *
 * @category Protocol
 */
export function *portExtensionsOf<T extends { readonly extension_name: string }>(device: { readonly extensions?: readonly T[] }): Generator<T> {

  for(const extension of device.extensions ?? []) {

    if(extension.extension_name === PORT_EXTENSION) {

      yield extension;
    }
  }
}

/* Each of a record's bindings as it is met, which is what lets the whole list and the first of it be one rule rather than two of them. An extension carrying no
 * target binds no door and is passed over: the port is there, but nothing says which door it serves, and answering with a binding whose door is undefined would be
 * inventing one. The conditional spreads are what keep an absent name or port off the object rather than present and undefined.
 */
function *portBindingsOf(device: AccessPortBindingSource): Generator<AccessPortBinding> {

  for(const extension of portExtensionsOf(device)) {

    if(extension.target_value === undefined) {

      continue;
    }

    yield { doorId: extension.target_value, ...((extension.target_name !== undefined) && { name: extension.target_name }),
      ...((extension.source_id !== undefined) && { port: extension.source_id }) };
  }
}

/**
 * Every door a hub's ports are bound to, in the order the controller delivered them.
 *
 * One binding is answered per port extension that names a door. An extension binding no door is left out rather than answered with an empty identity, so a
 * consumer iterating this reads ports that lead somewhere and nothing else. A record carrying no extensions at all - a synthesized per-port access point, or
 * anything a token-only census produced - answers an empty list.
 *
 * @param device - Any device record (only its extensions are read).
 *
 * @returns The bindings in delivered order.
 *
 * @category Protocol
 */
export function readPortBindings(device: AccessPortBindingSource): readonly AccessPortBinding[] {

  return [...portBindingsOf(device)];
}

/**
 * The first binding {@link readPortBindings} would answer, or `undefined` where the record carries none.
 *
 * It exists beside the whole list because the door-identity getter runs on every command a hub handle issues and wants one answer rather than an array it then
 * indexes. Both read the same generator, so the first binding here and the first of that list are the same binding by construction.
 *
 * @param device - Any device record (only its extensions are read).
 *
 * @returns The first binding in delivered order, or `undefined` where nothing binds a door.
 *
 * @category Protocol
 */
export function firstPortBinding(device: AccessPortBindingSource): AccessPortBinding | undefined {

  for(const binding of portBindingsOf(device)) {

    return binding;
  }

  return undefined;
}
