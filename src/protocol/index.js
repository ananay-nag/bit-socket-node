import { encodeFrame, defaultEncodePayload } from './encoder.js';
import { decodeFrame, defaultDecodePayload } from './decoder.js';
import * as Constants from './constants.js';
import { Schema } from './schema.js';

export const BitSocketProtocol = {
  ...Constants,
  encodePayload: defaultEncodePayload,
  decodePayload: defaultDecodePayload,
  encodeFrame: function(options, customSerializers) {
    return encodeFrame(options, customSerializers || this);
  },
  decodeFrame: function(buffer, customSerializers) {
    return decodeFrame(buffer, customSerializers || this);
  }
};

export { Schema };
