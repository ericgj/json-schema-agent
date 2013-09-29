var type = require('type')
  , each = require('each')
  , Emitter = require('emitter')
  , Uri  = require('json-schema-uri')
  , has  = Object.hasOwnProperty

module.exports = Ref;

function Ref(agent){
  if (!(this instanceof Ref)) return new Ref(agent);
  this._referents = {}; this._referrers = {};
  this.agent = agent;
  return this;
}

Ref.prototype = new Emitter();

Ref.prototype.root = function(){
  return this.obj;
}

Ref.prototype.parse = function(obj){
  this._referents = {}; this._referrers = {};
  this.obj = obj;
  traverse({'#': obj}, extract.bind(this));
  return this;
}

Ref.prototype.addReferent = function(uri,path){
  this._referents[uri.toString()] = path;
}

Ref.prototype.addReferrer = function(path,uri){
  this._referrers[path] = uri;
}

Ref.prototype.getReferent = function(uri){
  return this._referents[uri.toString()];
}

Ref.prototype.getReferrer = function(path){
  return this._referrers[path];
}

Ref.prototype.eachReferent = function(fn){
  each(this._referents, fn);
}

Ref.prototype.eachReferrer = 
Ref.prototype.each = function(fn){
  each(this._referrers, fn);
}

/*
 * Find fragment given id-based or JSON-Pointer key
 * Key is URI-canonicalized against root id (if present),
 *   then path looked up in referents (id-based lookup).
 * If not found, treat fragment part of URI as path (JSON-Pointer),
 *   starting from the base part of URI looked up in referents.
 *
 */
Ref.prototype.$ =
Ref.prototype.fragment = function(key){
  var root = this.root()
  if (!root) return;
  var uri = Uri(root.id || '').join(key)
  var ret = this.getId(uri)
  if (ret) return ret;
  if (!uri.isFragment()){
    root = this.getId(uri.base());
  }
  if (!root) return;
  ret = this.getPath(uri.fragment(),root);
  return ret;
}

/*
 * Find fragment from id
 * Note id should be a canonical URI (object or string)
 *
 */
Ref.prototype.getId   = function(id){
  var path = this.getReferent(id);
  if (!path) return;
  return this.getPath(path);
}

/*
 * Find fragment given path (JSON pointer)
 *
 */
Ref.prototype.getPath = function(path,obj){
  var obj = obj || this.obj;
  var segs = path.split('/')
    , seg = segs.shift()
    , path = segs.join('/')
  if ('#' == seg) return this.getPath(path,this.obj);  // from the top 
  if (0 == seg.length && 0 == segs.length) return obj; 
  if (!has.call(obj,seg)) return; // or throw error ?
  if (0 == path.length){
    return obj[seg];
  } else {
    return this.getPath(path,obj[seg]);
  }
}

Ref.prototype.dereference = function(fn){
  var self = this
  if (fn){
    this.once('ready', fn);
    this.once('error', fn);
  }
  var remotes = []
  this.eachReferrer( function(from,target){
    inlineDereference.call(self,from,target) || 
      remotes.push([from,target]);
  })
  if (remotes.length == 0) {
    self.emit('ready');
  } else {
    while (remotes.length){
      var next = remotes.shift()
      next.push(remotes.length == 0);
      asyncDereference.apply(self,next);
    }
  }
}

// private 

function inlineDereference(from,target,doc){
  doc = doc || this;
  var ref = this.$(target)  // try inline dereference by URI or JSON pointer 
  if (ref) setPath.call(this,from,ref);
  return (!!ref);
}

function asyncDereference(from,uri,last){
  var self = this, agent = this.agent
  agent.getCache(uri, function(err,obj){
    if (err){
      self.emit('error', err);
      return;
    }

    setPath.call(self,from,obj);
    if (last) self.emit('ready');

  })
}

//TODO rethrow error if parent not found?
function setPath(path,ref){
  var parts = path.split('/')
    , key = parts.pop()
    , parent = this.getPath(parts.join('/'))
  if (parent) {
    var val = {}; parent[key] = val;
    for (var k in ref){
      if (k !== 'id') val[k] = ref[k];
    }
  }
}



function extract(obj,key,ctx){
  // console.log("context path, scopes: %s -> %s", ctx.path, ctx.uri.toString());
  if (key == 'id'){
    this.addReferent(ctx.uri, ctx.path);
  }
  var val = obj[key]
  if (!val || !type(val == 'object')) return;
  if (has.call(val,'$ref')){
    this.addReferrer(ctx.childPath, ctx.uri.join(val['$ref']).toString() );
  }
}

// utils

function traverse(obj, ctx, fn){
  if (arguments.length == 2){ 
    fn = ctx; ctx = undefined;
  }
  ctx          = ctx || {};
  ctx.segments = ctx.segments || [];
  ctx.scopes   = ctx.scopes || [ Uri('') ];
  ctx.uri      = ctx.scopes[ctx.scopes.length-1];
  switch(type(obj)){
    case 'array':
    for (var i=0;i<obj.length;++i){
      ctx.path     = ctx.segments.join('/');  // parent path
      ctx.segments.push(i);
      ctx.childPath = ctx.segments.join('/'); 
      fn(obj,i,ctx);
      if (has.call(obj,i)) traverse(obj[i],ctx,fn);
      ctx.segments.pop();
    }
    break;
    
    case 'object':
    if (obj.id){
      ctx.scopes.push( ctx.uri.join(obj.id) );
      ctx.uri = ctx.scopes[ctx.scopes.length-1];
    }
    for (var k in obj){
      if (k == 'enum') continue;
      ctx.path     = ctx.segments.join('/');  // parent path
      ctx.segments.push(k);
      ctx.childPath = ctx.segments.join('/'); 
      fn(obj,k,ctx);
      if (has.call(obj,k)) traverse(obj[k],ctx,fn);
      ctx.segments.pop();
    }
    if (obj.id) {
      ctx.scopes.pop();
      ctx.uri = ctx.scopes[ctx.scopes.length-1];
    }
    break;
  }
}
