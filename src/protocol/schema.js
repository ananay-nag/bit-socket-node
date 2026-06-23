import { encode as msgpackEncode, decode as msgpackDecode } from '@msgpack/msgpack';

function computeSize(type, val, stringQueue, encoder) {
  if (typeof type === 'string') {
    switch (type) {
      case 'uint8':
      case 'boolean':
        return 1;
      case 'uint16':
        return 2;
      case 'uint32':
      case 'int32':
        return 4;
      case 'float64':
        return 8;
      case 'string': {
        const encoded = encoder.encode(val || '');
        stringQueue.push(encoded);
        return 4 + encoded.length;
      }
      case 'bytes': {
        const bytes = val || new Uint8Array(0);
        return 4 + bytes.byteLength;
      }
      case 'object':
      case 'array':
      case 'any': {
        const bytes = msgpackEncode(val !== undefined ? val : null);
        stringQueue.push(bytes);
        return 4 + bytes.length;
      }
      default:
        throw new Error(`BitSocket Schema Error: Unsupported type '${type}'`);
    }
  } else if (Array.isArray(type)) {
    const elementType = type[0];
    const arr = Array.isArray(val) ? val : [];
    let size = 4;
    for (let i = 0; i < arr.length; i++) {
      size += computeSize(elementType, arr[i], stringQueue, encoder);
    }
    return size;
  } else if (typeof type === 'object' && type !== null) {
    let size = 0;
    const obj = (val !== null && typeof val === 'object') ? val : {};
    const keys = Object.keys(type);
    for (const key of keys) {
      size += computeSize(type[key], obj[key], stringQueue, encoder);
    }
    return size;
  }
  throw new Error(`BitSocket Schema Error: Invalid schema type definition`);
}

function encodeValue(type, val, buffer, view, offsetRef, stringQueue) {
  if (typeof type === 'string') {
    switch (type) {
      case 'uint8':
        view.setUint8(offsetRef.offset, val || 0);
        offsetRef.offset += 1;
        break;
      case 'boolean':
        view.setUint8(offsetRef.offset, val ? 1 : 0);
        offsetRef.offset += 1;
        break;
      case 'uint16':
        view.setUint16(offsetRef.offset, val || 0, false);
        offsetRef.offset += 2;
        break;
      case 'uint32':
        view.setUint32(offsetRef.offset, val || 0, false);
        offsetRef.offset += 4;
        break;
      case 'int32':
        view.setInt32(offsetRef.offset, val || 0, false);
        offsetRef.offset += 4;
        break;
      case 'float64':
        view.setFloat64(offsetRef.offset, val || 0, false);
        offsetRef.offset += 8;
        break;
      case 'string': {
        const encoded = stringQueue.shift();
        view.setUint32(offsetRef.offset, encoded.length, false);
        offsetRef.offset += 4;
        buffer.set(encoded, offsetRef.offset);
        offsetRef.offset += encoded.length;
        break;
      }
      case 'bytes': {
        const bytes = val || new Uint8Array(0);
        view.setUint32(offsetRef.offset, bytes.byteLength, false);
        offsetRef.offset += 4;
        buffer.set(new Uint8Array(bytes.buffer || bytes, bytes.byteOffset, bytes.byteLength), offsetRef.offset);
        offsetRef.offset += bytes.byteLength;
        break;
      }
      case 'object':
      case 'array':
      case 'any': {
        const encoded = stringQueue.shift();
        view.setUint32(offsetRef.offset, encoded.length, false);
        offsetRef.offset += 4;
        buffer.set(encoded, offsetRef.offset);
        offsetRef.offset += encoded.length;
        break;
      }
    }
  } else if (Array.isArray(type)) {
    const elementType = type[0];
    const arr = Array.isArray(val) ? val : [];
    view.setUint32(offsetRef.offset, arr.length, false);
    offsetRef.offset += 4;
    for (let i = 0; i < arr.length; i++) {
      encodeValue(elementType, arr[i], buffer, view, offsetRef, stringQueue);
    }
  } else if (typeof type === 'object' && type !== null) {
    const obj = (val !== null && typeof val === 'object') ? val : {};
    const keys = Object.keys(type).sort();
    for (const key of keys) {
      encodeValue(type[key], obj[key], buffer, view, offsetRef, stringQueue);
    }
  }
}

function decodeValue(type, view, dataView, offsetRef, decoder) {
  if (typeof type === 'string') {
    switch (type) {
      case 'uint8': {
        const val = dataView.getUint8(offsetRef.offset);
        offsetRef.offset += 1;
        return val;
      }
      case 'boolean': {
        const val = dataView.getUint8(offsetRef.offset) !== 0;
        offsetRef.offset += 1;
        return val;
      }
      case 'uint16': {
        const val = dataView.getUint16(offsetRef.offset, false);
        offsetRef.offset += 2;
        return val;
      }
      case 'uint32': {
        const val = dataView.getUint32(offsetRef.offset, false);
        offsetRef.offset += 4;
        return val;
      }
      case 'int32': {
        const val = dataView.getInt32(offsetRef.offset, false);
        offsetRef.offset += 4;
        return val;
      }
      case 'float64': {
        const val = dataView.getFloat64(offsetRef.offset, false);
        offsetRef.offset += 8;
        return val;
      }
      case 'string': {
        const len = dataView.getUint32(offsetRef.offset, false);
        offsetRef.offset += 4;
        const val = decoder.decode(view.subarray(offsetRef.offset, offsetRef.offset + len));
        offsetRef.offset += len;
        return val;
      }
      case 'bytes': {
        const len = dataView.getUint32(offsetRef.offset, false);
        offsetRef.offset += 4;
        const val = new Uint8Array(view.subarray(offsetRef.offset, offsetRef.offset + len));
        offsetRef.offset += len;
        return val;
      }
      case 'object':
      case 'array':
      case 'any': {
        const len = dataView.getUint32(offsetRef.offset, false);
        offsetRef.offset += 4;
        const sub = view.subarray(offsetRef.offset, offsetRef.offset + len);
        const val = msgpackDecode(sub);
        offsetRef.offset += len;
        return val;
      }
    }
  } else if (Array.isArray(type)) {
    const elementType = type[0];
    const len = dataView.getUint32(offsetRef.offset, false);
    offsetRef.offset += 4;
    const arr = new Array(len);
    for (let i = 0; i < len; i++) {
      arr[i] = decodeValue(elementType, view, dataView, offsetRef, decoder);
    }
    return arr;
  } else if (typeof type === 'object' && type !== null) {
    const obj = {};
    const keys = Object.keys(type).sort();
    for (const key of keys) {
      obj[key] = decodeValue(type[key], view, dataView, offsetRef, decoder);
    }
    return obj;
  }
}

export class Schema {
  constructor(name, definition) {
    if (typeof name !== 'string') {
      definition = name;
      name = 'unknown';
    }

    if (name !== 'unknown' && !/^[a-zA-Z0-9_]+$/.test(name)) {
      throw new Error(`Invalid Schema Name: '${name}'. Schema names must be a single word containing only letters, numbers, and underscores (no spaces or special characters).`);
    }

    this.definition = definition;
    this.schemaName = name;
  }

  encodePayload(payload) {
    const encoder = new TextEncoder();
    const stringQueue = [];
    const size = computeSize(this.definition, payload, stringQueue, encoder);

    const buffer = new Uint8Array(size);
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const offsetRef = { offset: 0 };

    encodeValue(this.definition, payload, buffer, view, offsetRef, stringQueue);

    return buffer;
  }

  decodePayload(buffer) {
    const view = new Uint8Array(buffer);
    const dataView = new DataView(view.buffer, view.byteOffset, view.byteLength);
    const decoder = new TextDecoder();
    const offsetRef = { offset: 0 };

    return decodeValue(this.definition, view, dataView, offsetRef, decoder);
  }
}
