'use strict';

var isBrowser = require('is-browser')
  , Emitter = isBrowser ? require('emitter') : require('emitter-component')
  , Uri = isBrowser ? require('json-schema-uri') : require('json-schema-uri-component')

module.exports = Deref;

function Deref(agent,schema,fn,crumb){
  if (!(this instanceof Deref)) return new Deref(agent,schema,fn,crumb);
  this.agent = agent;
  this.crumb = crumb || [];
  if (schema) this.dereference(schema,fn);
  return this;
}

Deref.prototype = new Emitter();

Deref.prototype.dereference = function(schema,fn){

  schema = schema.root() || schema;
  var remotes = [];
  var self = this;
  var crumb = this.crumb;

  if (fn){ 
    this.once('ready',fn); 
    this.once('error',fn);
  }

  schema.eachRef( function(uri,node,key){
    inlineDereference(schema,uri,node,key) ||
      remotes.push([uri,node,key]);
  })
  
  if (remotes.length == 0) {
    self.emit('ready');
  } else {
    while (remotes.length){
      var args = remotes.shift()
      args.push(remotes.length == 0);
      args.push(crumb);
      asyncDereference.apply(self,args);
    }
  }
}

// private 

function inlineDereference(schema,uri,node,key){
  var ref = schema.$(uri)  // try inline dereference by URI or JSON pointer 
  if (ref) node.set(key,ref);
  return (!!ref);
}

function asyncDereference(uri,node,key,last,crumb){
  var self = this, agent = this.agent
    , baseUri = Uri(uri).base().toString()
  
  if (~indexOf(crumb,baseUri)) {
    var e = new Error('Cyclical references found: "' + uri + 
                      '" in ' + crumb[crumb.length-1]
                     );
    e.references = crumb;
    self.emit('error', e);
    return;
  }

  agent.getCache(uri, function(err,refnode){
    if (err){
      self.emit('error', err);
      return;
    }

    node.set(key,refnode);

    if (last) self.emit('ready');

  }, crumb )
}


// inlined

function indexOf(arr, obj){
  if (arr.indexOf) return arr.indexOf(obj);
  for (var i = 0; i < arr.length; ++i) {
    if (arr[i] === obj) return i;
  }
  return -1;
};

