'use strict';

var core = require('json-schema-core')
  , hyper = require('json-schema-hyper')
  , Uri = require('json-schema-uri')
  , getLinkHeaderHrefs = require('./linkheader')
  
var Correlation = core.Correlation
  , Schema = core.Schema
  , Document = core.Document


module.exports = Agent;

function Agent(cache){
  if (!(this instanceof Agent)) return new Agent(cache);
  this._cache = cache || new Cache;
  return this;
}

Schema.use(hyper);
Agent.Schema = Schema;

Agent.service = function(klass){ 
  if (arguments.length > 0) { this.Service = klass; }
  else { return this.Service; }
}
 
function Cache(){
  this._cache = {};
}
Cache.prototype.get = function(uri){ return this._cache[uri]; }
Cache.prototype.set = function(uri,obj){ this._cache[uri] = obj; }



Agent.prototype.base = function(base){
  if (arguments.length > 0) { this._base = base; }
  else { return this._base }
}

Agent.prototype.get = function(link,obj,fn){
  follow.call(this,'get',link,obj,fn);
}

Agent.prototype.head = function(link,obj,fn){
  follow.call(this,'head',link,obj,fn);
}

Agent.prototype.put = function(link,obj,fn){
  follow.call(this,'put',link,obj,fn);
}

Agent.prototype.post = function(link,obj,fn){
  follow.call(this,'post',link,obj,fn);
}

Agent.prototype.patch = function(link,obj,fn){
  follow.call(this,'patch',link,obj,fn);
}

Agent.prototype.del = function(link,fn){
  follow.call(this,'del',link,undefined,fn);
}


// follow link based on method property

Agent.prototype.follow = function(link,obj,fn){
  link = linkAttributes(link);
  var meth = (link.method || 'GET').toLowerCase();
  if (meth == 'delete') meth = 'del';

  var agent = this
  var wrap = function(err,res){
    if (err){ fn(err); return; }
    wrapCorrelate.call(agent, link.targetSchema,res,fn); 
  }

  follow.call(this,meth,link,obj,wrap);
}

Agent.prototype.getCache = function(uri, fn){
  var agent = this
    , schemaUri = Uri(this.base()).join(Uri(uri))
    , base = schemaUri.base()
    , fragment = schemaUri.fragment()
    , cached = agent._cache.get(base)

  // cache hit
  if (cached){
    fn(undefined,cached,fragment);

  // cache miss
  } else {
    follow.call(agent, 'get', schemaUri, function(err,res,fragment){
      if (err){ fn(err); return; }
      var obj = res.body;
      obj.id = obj.id || base;
      agent._cache.set(base,obj);
      fn(err,obj,fragment);
    })
  }
}


// private 

function follow(meth,link,obj,fn){
  var agent = this;
   
   // parameter normalization
  if ('function' == typeof obj){
    fn = obj; obj = undefined;
  }
  link = linkAttributes(link);
 
  // input schema validation
  var err = validate(link.schema,obj);
  if (err){ fn(err); return; }
 
  // build request
  var request = Agent.Service();

  if (!request[meth]){
    var err = new Error("Unknown method: '" + meth + "'");
    fn(err); return;
  }

  var uri     = Uri(this.base()).join(Uri(link.href))
    , baseuri = uri.base()
    , fragment = uri.fragment()
    , accept  = link.mediaType
    , encType = link.encType

  encType = encType || (link.method == 'POST' ? 
                          'application/json' : 
                          undefined
                       );

  if (accept)  request.set('Accept', accept);
  if (encType) request.set('Content-Type', encType);
    
  var wrap = function(err,res){
    fn(err,res,fragment);
  }

  // send request
  if (obj){
    request[meth](baseuri, obj, wrap);
  } else {
    request[meth](baseuri, wrap);
  }
 
}

// private

function wrapCorrelate(targetSchema,res,fn){
  var agent = this
    , instance = res.body
  var schemaUris = getSchemaURIs(res);

  // no schemas specified, use blank
  if (!schemaUris || schemaUris.length == 0){
    var schema = new Schema()
    fn.apply(
      undefined,
      buildCorrelate(schema,instance,targetSchema)
    );
  
  // load each raw schema specified and build union schema
  } else {
    correlateSchemas(schemaUris,instance,targetSchema,fn);
  }
}

function correlateSchemas(uris,instance,targetSchema,fn){
  var agent = this
    , raws = []
  while (uris.length) {
    var uri = uris.shift()
    agent.getCache(uri, function(err,obj,fragment){
      if (err){ return; }  // ignore if error getting one schema, not quite right
      obj = getPath(obj,fragment) || {};   // get fragment path, id-based paths not supported
      raws.push(obj);

      if (uris.length == 0){
        var union = raws[0];
        if (raws.length > 1) union = { allOf: raws };
        var doc = new Document(agent).parse(union);
        doc.dereference( function(){
          fn.apply(
            undefined,
            buildCorrelate(doc.root(),instance,targetSchema)
          );
        });
      }

    });
  }
}


// utils

function linkAttributes(link){
  if ("string" == typeof link){
    return {href: link};
  } else if (link.nodeType && link.nodeType == "Link"){
    return link.attributes();
  }
  return link;
}

function validate(schema,obj){
  if (obj && schema && schema.validate){
    var check = schema.validate(obj);
    if (!check.valid){
      var err = buildError(new Error(), check);
      return err;
    }
  }
}

function buildCorrelate(schema,instance,targetSchema){
  var corr = schema.bind(instance);
  var err = validate(targetSchema,instance);
  if (err) return [err,corr];
  return [undefined, corr];
}


function buildError(err,data){
  data.message = err.message;
  err.data = data;
  return err;
}

// TODO
function getPath(obj,path){
  return obj;
}

function getSchemaURIs(res){
  var profile = getContentTypeProfile(res) 
  return profile ? [profile] 
                 : getDescribedByLinks(res);
}

function getContentTypeProfile(res){
  if (res.profile) {
    return res.profile;  // content-type params automatically set
  } else {
    // manual parse content-type params
    var ct = res.header['content-type'] || res.header['Content-Type'];
    if (ct) return params(ct).profile;
    return undefined;
  }
}

function getDescribedByLinks(res){
  var raw = res.header['link'] || res.header['Link'];
  if (!raw) return [];
  return getLinkHeaderHrefs(raw,'describedBy');
}


// taken from visionmedia/superagent

function params(str){
  return reduce(str.split(/ *; */), function(obj,str){
    var parts = str.split(/ *= */)
      , key = parts.shift()
      , val = parts.shift();

    if (key && val) obj[key] = val;
    return obj;
  }, {});
}

// inlined from RedVentures/reduce

function reduce(arr, fn, initial){  
  var idx = 0;
  var len = arr.length;
  var curr = arguments.length == 3
    ? initial
    : arr[idx++];

  while (idx < len) {
    curr = fn.call(null, curr, arr[idx], ++idx, arr);
  }
  
  return curr;
};
