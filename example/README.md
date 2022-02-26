# Example

There is a node server that supports
Server Side Rendering and uses webpack-dev-middleware. It starts
via nodemon, so any change to the code restarts whole server.

**Problems:**
1. every restart of the server causes webpack-dev-middleware
to recompile from scratch whole client app (which could be time consuming)
instead of just to apply a change.
1. even if you change only the client app related file you still need to
restart the server in order to consume new changes for SSR which leads
to problem 1.

**Solution:** use modulik to 1) import SSR module, 2) specify SSR related modules
to be watched for changes and 3) exclude SSR and App files from
nodemon watching.

**Result:**
1. changes to SSR module don't restart whole server but only SSR module itself.
1. changes to App component cause webpack-dev-middleware to just update
client-app's assets because whole server was not restarted but rather only the
SSR module.
