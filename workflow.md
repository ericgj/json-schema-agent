The following is pseudocode for the (somewhat mind-bending) process
of correlating instances with schemas when making an HTTP request.


    get instance  [[ follow ]]:

      wrap response as correlation:  [[ wrapCorrelate ]]

        find schema uri(s) in response
        if no schema,
          yield correlation with empty schema  [ buildCorrelate ]
        else if schema(s):

          fetch schemas, dereference:

            for each schema uri, map:
              get schema:
                look up schema in cache by uri
                if in cache,
                  if fragment specified,
                    find resulting subschema from schema and yield result 
                  else
                    yield cached schema
                if not in cache,
                  get schema as instance [ follow ], and with the yielded correlation:
                    set instance id ||= uri
                    parse as schema
                    if fragment specified,
                      schema = find resulting subschema 
                    dereference schema :
                      dereference inline refs
                      dereference canonical refs:
                        for each uri:
                          [ getSchema ]
                        set reference 
                      on ready, save to cache
                      yield dereferenced schema

              if the last schema:
                if there was >1 schemas,
                  schema = build union schema
                yield schema
                

              with yielded schema:
                yield correlation, validating against targetSchema  [ buildCorrelate ]


