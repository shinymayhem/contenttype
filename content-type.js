/* eslint-env node */
// Licence: PUBLIC DOMAIN <http://unlicense.org/>
// Author: Austin Wright <http://github.com/Acubed>

var MediaType = module.exports = function MediaType(s, p) {
  this.type = "";
  this.params = {};
  var c,
      i,
      n;

  if (typeof s === "string") {
    c = splitQuotedString(s);

    this.type = c.shift();

    for (i = 0; i < c.length; ++i) {
      this.parseParameter(c[i]);
    }
  } else if (s instanceof MediaType) {
    this.type = s.type;

    this.q = s.q;

    for (n in s.params) {
      this.params[n] = s.params[n];
    }
  }

  if (typeof p === "string") {
    c = splitQuotedString(p);

    for (i = 0; i < c.length; ++i) {
      this.parseParameter(c[i]);
    }
  } else if (typeof p === "object") {
    for (n in p) {
      this.params[n] = p[n];
    }
  }
};

MediaType.prototype.parseParameter = function parseParameter(s) {
  var param = s.split("=", 1);

  var name = param[0].trim();

  var value = s.substr(param[0].length + 1).trim();

  if (!value || !name) {
    return;
  }

  // TODO Per http://tools.ietf.org/html/rfc7231#section-5.3.2 everything
  //   after the q-value is accept-ext
  //if (name === "q" && typeof this.q === "undefined") {
  if (name === "q") {
    this.q = parseFloat(value);
  } else {
    if (value[0] === '"' && value[value.length - 1] === '"') {
      value = value.substr(1, value.length - 2).replace(/\\(.)/g, function replace(a, b) {
        return b;
      });
    }

    this.params[name] = value;
  }
};

MediaType.prototype.toString = function toString() {
  var str = this.type;

  var params = Object.keys(this.params).sort();

  for (var i = 0; i < params.length; ++i) {
    var n = params[i];

    if (this.params[n].match(/^[!#$%&'*+\-.^_`|~0-9a-zA-Z]+$/)) {
      str += this.params[n];
    } else {
      str += '"' + this.params[n].replace(/["\\]/g, function replace(a) {
        return '\\' + a;
      }) + '"';
    }
  }
  if (typeof this.q === 'number' && this.q >= 0) {
    var q = Math.min(this.q, 1).toFixed(3).replace(/0*$/, '').replace(/\.$/, '');
    str += '; q=' + q;
  }

  return str;
};

// Split a string by character, but ignore quoted parts and backslash-escaped
// characters
var splitQuotedString = MediaType.splitQuotedString = function splitQuotedString(str, delim, quote) {
  delim = delim || ";";
  quote = quote || '"';

  var res = [];

  var start = 0;
  var offset = 0;

  var findNextChar = function findNextChar(v, c, i, a) {
    var p = str.indexOf(c, offset + 1);

    var result;
    if (p < 0) {
      result = v;
    } else {
      result = Math.min(p, v);
    }
    return result;
  };

  while (offset >= 0) {
    offset = [delim, quote].reduce(findNextChar, 1 / 0);

    if (offset === 1 / 0) {
      break;
    }

    switch (str[offset]) {
      case quote:
        // Skip to end of quoted string
        while (1) {
          offset = str.indexOf(quote, offset + 1);
          if (offset < 0) {
            break;
          }
          if (str[offset - 1] === "\\") {
            continue;
          }
          break;
        }
        continue;
      case delim:
        res.push(str.substr(start, offset - start).trim());
        start = ++offset;
        break;
    }
  }

  res.push(str.substr(start).trim());

  return res;
};

// Split a list of content types found in an Accept header
// Maybe use it like: splitContentTypes(request.headers.accept).map(parseMedia)
MediaType.splitContentTypes = function splitContentTypes(str) {
  return MediaType.splitQuotedString(str, ",");
};

MediaType.parseMedia = function parseMedia(str) {
  return new MediaType(str);
};

MediaType.sortByQuality = function sortByQuality(types) {
  return types.sort(function sort(a, b) {
    if (a.q === b.q) {
      return 0;
    }

    if (typeof a.q === "undefined" && typeof b.q !== "undefined") {
      return -1;
    }

    if (typeof b.q === "undefined" && typeof a.q !== "undefined") {
      return 1;
    }

    if (a.q > b.q) {
      return 1;
    } else if (a.q < b.q) {
      return -1;
    }
    return 0;
  });
};

MediaType.sortBySpecificity = function sortBySpecificity(types) {
  return types.sort(function sort(a, b) {
    var bitsA = a.type.split("/"),
        bitsB = b.type.split("/");

    if (bitsA[0] === "*" && bitsB[0] !== "*") {
      return 1;
    }

    if (bitsB[0] === "*" && bitsA[0] !== "*") {
      return -1;
    }

    if (bitsA[1] === "*" && bitsB[1] !== "*") {
      return 1;
    }

    if (bitsB[1] === "*" && bitsA[1] !== "*") {
      return -1;
    }

    var keysA = Object.keys(a.params),
        keysB = Object.keys(b.params);

    if (keysA.length < keysB.length) {
      return 1;
    }

    if (keysB.length < keysA.length) {
      return -1;
    }

    return 0;
  });
};

MediaType.firstMatch = function firstMatch(availableTypes, acceptedTypes) {
  for (var i = 0; i < acceptedTypes.length; ++i) {
    for (var j = 0; j < availableTypes.length; ++j) {
      var comparison = MediaType.mediaCmp(acceptedTypes[i], availableTypes[j]);

      if (comparison !== null && comparison >= 0) {
        return availableTypes[j];
      }
    }
  }

  return null;
};

// Pick an ideal representation to send given a list of representations
// to choose from and the client-preferred list
MediaType.select = function select(availableTypes, acceptedTypes, options) {
  options = options || {
    sortAvailable: false,
    sortAccepted: true
  };

  if (options.sortAvailable) {
    availableTypes = MediaType.sortByQuality(MediaType.sortBySpecificity(availableTypes));
  }

  if (options.sortAccepted) {
    acceptedTypes = MediaType.sortByQuality(MediaType.sortBySpecificity(acceptedTypes));
  }

  return MediaType.firstMatch(availableTypes, acceptedTypes);
};

// Determine if one media type is a subset of another
// If a is a superset of b (b is smaller than a), return 1
// If b is a superset of a, return -1
// If they are the exact same, return 0
// If they are disjoint, return null
MediaType.mediaCmp = function mediaCmp(a, b) {
  if (a.type === "*/*" && b.type !== "*/*") {
    return 1;
  } else if (a.type !== "*/*" && b.type === "*/*") {
    return -1;
  }

  var ac = (a.type || "").split("/");
  var bc = (b.type || "").split("/");

  if (ac[0] === "*" && bc[0] !== "*") {
    return 1;
  }

  if (ac[0] !== "*" && bc[0] === "*") {
    return -1;
  }

  if (a.type !== b.type) {
    return null;
  }

  var ap = a.params || {};
  var bp = b.params || {};

  var ak = Object.keys(ap);
  var bk = Object.keys(bp);

  if (ak.length < bk.length) {
    return 1;
  }

  if (ak.length > bk.length) {
    return -1;
  }

  var dir = 0;

  for (var n in ap) {
    if (ap[n] && typeof bp[n] === "undefined") {
      if (dir < 0) {
        return null;
      }
      dir = 1;
    }

    if (bp[n] && typeof ap[n] === "undefined") {
      if (dir > 0) {
        return null;
      }
      dir = -1;
    }

    if (ap[n] && bp[n] && ap[n] !== bp[n]) {
      return null;
    }
  }

  return dir;
};
