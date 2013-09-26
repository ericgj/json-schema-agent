The following is pseudocode for the (somewhat mind-bending) process
of correlating instances with schemas when making an HTTP request.


    get instance [[ follow ]]:
      
      wrap response as correlation:  [[ wrapCorrelate ]]
      
        find schema uri(s) in response
        if no schema, 
          yield correlation with empty schema  [ buildCorrelate ] 
        else if schemas,
          fetch and dereference and correlate schemas:  [[ correlateSchemas ]]

            for each schema uri, map:

              get schema [[ getSchema ]]:
                look up schema in cache by uri
                if in cache,
                  if fragment specified,
                    dereference schema, find fragment and yield result  [ dereferenceSchema ]
                  else
                    yield cached schema object
                if not in cache,
                  get schema as instance [ follow ], and with the yielded correlation:
                    set instance id ||= uri
                    save to cache
                    if fragment specified,
                      dereference schema, find fragment and yield result  [ dereferenceSchema ]
                    else
                      yield schema object

              if the last schema,
                if there was >1 schema,
                  build union schema object
                
                dereference schema object (if not already dereferenced) [[ dereferenceSchema ]] :
                  dereference inline refs
                  dereference canonical refs:
                    for each uri:
                      [ getSchema ]
                    set path on schema object to yielded schema object/fragment

                with yielded result
                  build schema from schema object
                  yield correlation, validating against targetSchema  [ buildCorrelate ]


One tricky part is, the raw schema object is dereferenced only as needed.
This may be either (a) if one of the correlated schemas is a _document fragment_
or (b) after _all_ correlated schemas are fetched. The point is that dereferencing
should be idempotent, it harms nor costs nothing to do it several times. After the
first time, the `$ref`s should have been resolved so it should no longer
do a remote fetch the second time.

