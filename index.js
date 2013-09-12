'use strict';

var core = require('json-schema-core')
  , hyper = require('json-schema-hyper')
  , uri = require('./uri')
  , canonicalURI = uri.canonicalURI
  , baseURI = uri.baseURI
  , fragmentURI = uri.fragmentURI
  
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
Cache.prototype.set = function(uri,doc){ this._cache[uri] = doc; }



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
  if ("string" == typeof link) link = {href: link};
  var meth = (link.method || 'GET').toLowerCase();
  if (meth == 'delete') meth = 'del';
  follow.call(this,meth,link,obj,fn);
}

// private 

function follow(meth,link,obj,fn){
  var agent = this;
   
   // parameter normalization
  if ('function' == typeof obj){
    fn = obj; obj = undefined;
  }
  if ("string" == typeof link) link = {href: link};

  // input schema validation
  var err = validate(link.schema,obj);
  if (err){ fn(err); return; }
 
  // build request
  var request = Agent.Service();

  if (!request[meth]){
    var err = new Error("Unknown method: '" + meth + "'");
    fn(err); return;
  }

  var uri     = canonicalURI(this.base(),link.href)
    , baseuri = baseURI(uri)
    , accept  = link.mediaType
    , encType = link.encType

  encType = encType || (link.method == 'POST' ? 
                          'application/json' : 
                          undefined
                       );

  if (accept)  request.set('Accept', accept);
  if (encType) request.set('Content-Type', encType);
    
  var wrap = function(err,res){
    if (err){ fn(err); return; }  
    wrapCorrelate.call(agent, link.targetSchema,res,fn); 
  }

  // send request, wrapping response
  if (obj){
    request[meth](baseuri, obj, wrap);
  } else {
    request[meth](baseuri, wrap);
  }
 
}

function wrapCorrelate(targetSchema,res,fn){
  var agent = this;
  var schemaUri = getSchemaURI(res);
  if (!schemaUri){
    var corr = new Correlation(undefined,res.body);
    fn(undefined,corr); return;
  }
  
  schemaUri = canonicalURI(agent.base(),schemaUri);
  var baseSchemaUri = baseURI(schemaUri)
    , fragment = fragmentURI(schemaUri)
    , baseDoc = agent._cache.get(baseSchemaUri)
    , instance = res.body
  
  if (baseDoc){
    fn.apply(
      undefined,
      buildCorrelate(fragment,baseDoc.root,instance,targetSchema)
    );
    return;
  } else {
    // cache miss
    agent.get(schemaUri, function(schemaerr,schemacorr){
      if (schemaerr) {
        fn(schemaerr); return;  // not sure this is right
      }
      baseDoc = new Document().parse(schemacorr.instance);
      baseDoc.dereference();  // todo if/when this is async, the rest of this block has to be done as callback
      agent._cache.set(baseSchemaUri,baseDoc);
      fn.apply( 
        undefined,
        buildCorrelate(fragment,baseDoc.root,instance,targetSchema)
      );
      return;
    })
  }
}

// utils

function validate(schema,obj){
  if (obj && schema && schema.validate){
    var check = schema.validate(obj);
    if (!check.valid){
      var err = buildError(new Error(), check);
      return err;
    }
  }
}

function buildCorrelate(fragment,schema,instance,targetSchema){
  var corr = schema.bind(instance);
  var err = validate(targetSchema,instance);
  if (err) return [err,corr];

  // todo wrap error if fragment not found
  if (fragment) corr = corr.$(fragment);
  
  return [undefined, corr];

}


function buildError(err,data){
  data.message = err.message;
  err.data = data;
  return err;
}


function getSchemaURI(res){
  return getContentTypeProfile(res) ||
         getDescribedByLink(res);
}

function getContentTypeProfile(res){
  if (res.profile) {
    return res.profile;  // content-type params automatically set
  } else {
    // manual parse content-type params
    var ct = res.header['content-type'] || res.header['Content-Type'];
    return params(ct).profile;
  }
}

function getDescribedByLink(res){
  var link = res.header['link'] || res.header['Link'];
  // TODO PITA parsing of Link header
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
