
# json-schema-agent

  **Please note this library is not ready for production use.**

  JSON Hyper-Schema HTTP REST client. Together with [json-schema-core][core] 
  and [json-schema-hyper][hyper], this library provides a basic mechanism for
  correlating instances with schema over HTTP. It also provides validation 
  of request and response messages (`schema` and `targetSchema`), if 
  [json-schema-valid][valid] is used (forthcoming). 
  
  Refer to the JSON Schema [Core v4][speccore] and [Hyper-Schema][spechyper] 
  IETF Internet Draft specs for more info.


## Installation

    $ component install ericgj/json-schema-agent

## Examples

  ```javascript

  // Simple GET

  var agent = new Agent();
  agent.get('http://some.uri/path', function(err,correlation){
    correlation.instance  // the JSON instance (parsed body of response)
    correlation.schema    // the schema
  })


  // POST using link attributes

  var link = { href: 'http://example.com/thing',
               rel: 'create',
               mediaType: 'application/vnd.thing+json'
             }

  agent.post(link, obj, fn);

  // or automatically follow method defined in link

  link.method = 'POST'
  agent.follow(link, obj, fn);


  // follow chain of links

  agent.follow(link, function(err, correlation){
    var nextItem = correlation.rel('next');  // find link rel="next" in the schema
    agent.follow(nextItem, fn)
  })

  
  // Configuration
 
  // set base uri for resolving relative URIs in links
  agent.base('http://example.com/api'); 
  

  // set underlying http client (class)
  var httpClient = require('superagent');
  Agent.service(httpClient);


  ```

## API

   

## License

  MIT


## Limitations


- Note that an underlying HTTP client library must be specified, it is not
  built-in. The API for requests/responses is equivalent to a simple subset 
  of [superagent's][superagent]. So superagent is the easiest choice, but not
  the only one.

- The Correlation object is implemented in [json-schema-core][core], and 
extended in [json-schema-hyper][hyper], qq.v. for more examples of usage.

- Both Content-Type and Link header -style correlation methods are supported
(see [Core, sec. 8][speccore8]). However, specification of the _root relation_ 
via the Link header (see [Hyper-Schema, sec. 4.2][spechyper4-2]), is not 
currently supported. This may be implemented in the future.

- This library provides parsing of the `media` property within schemas, 
however the internal representation of media type values (i.e., the use of this
information in parsing the values) is left for the upstream application.

- The `readOnly` property within Link Description Object (LDO) schemas is
not currently validated during write operations (POST/PUT/PATCH). It is not
clear from [the spec][spechyper4-4] whether it is the responsibility of the 
client to do so.

- The `pathStart` schema property is not currently validated when correlating
instances ([Hyper-Schema, sec. 4.5][spechyper4-5]). This may be implemented in 
the future.

- Likewise, the determination of _authoritative_ representation of the `self`
link target is not currently implemented 
([Hyper-Schema, sec. 5.2.2][spechyper5-2-2]), but may be in the future.


[spechyper]: http://tools.ietf.org/html/draft-luff-json-hyper-schema-00
[spechyper4-2]: http://tools.ietf.org/html/draft-luff-json-hyper-schema-00#section-4.2
[spechyper4-4]: http://tools.ietf.org/html/draft-luff-json-hyper-schema-00#section-4.4
[spechyper4-5]: http://tools.ietf.org/html/draft-luff-json-hyper-schema-00#section-4.5
[spechyper5-2-2]: http://tools.ietf.org/html/draft-luff-json-hyper-schema-00#section-5.2.2
[speccore]: http://tools.ietf.org/html/draft-zyp-json-schema-04
[speccore8]: http://tools.ietf.org/html/draft-zyp-json-schema-04#section-8.1
[core]: https://github.com/ericgj/json-schema-core
[hyper]: https://github.com/ericgj/json-schema-hyper
[valid]: https://github.com/ericgj/json-schema-valid
[superagent]: https://github.com/visionmedia/superagent

