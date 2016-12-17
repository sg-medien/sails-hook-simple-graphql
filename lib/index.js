/**
 * Hook dependencies
 */
import _ from 'lodash';
import { createSchema } from './graphql';

var cors = require('cors');
var expressGraphQL = require('express-graphql')


export default function simpleGraphQL(sails) {
  return {
    /**
     * Hook defaults
     */
    defaults: {

      __configKey__: {
        graphqlPath: '/graphql',
        beforeGraphQL: (req, res, next) => next(),
      },
    },

    /**
     * Hook configuration
     */
    configure() {
      const that = this;
      const config = sails.config[that.configKey];

      // If the http hook was found
      if (sails.hooks.http) {
        // Add the http middleware 'cors' if no custom middleware exists
        if (_.isUndefined(sails.config.http.middleware.cors)) {
          sails.config.http.middleware.cors = cors(sails.config.cors);
        }

        // Add our custom http middleware 'simpleGraphQLMiddleware'
        sails.config.http.middleware.simpleGraphQLMiddleware = (req, res, next) => {
          if (req.url === config.graphqlPath) {

            if (config.beforeGraphQL && typeof config.beforeGraphQL === 'function') {
              return config.beforeGraphQL(req, res, () => {
                expressGraphQL({
                  schema: createSchema(sails.models, req),
                  pretty: true,
                })(req, res);
              });
            }

            return expressGraphQL({
              schema: createSchema(sails.models, req),
              pretty: true,
            })(req, res);
          }

          return next();
        };

        // Update middleware order
        if (sails.config.http.middleware.order.indexOf('passportSession') !== -1) {
          sails.config.http.middleware.order.splice(sails.config.http.middleware.order.indexOf('passportSession') + 1, 0, 'cors', 'simpleGraphQLMiddleware');
        } else if (sails.config.http.middleware.order.indexOf('passportInit') !== -1) {
          sails.config.http.middleware.order.splice(sails.config.http.middleware.order.indexOf('passportInit') + 1, 0, 'cors', 'simpleGraphQLMiddleware');
        } else if (sails.config.http.middleware.order.indexOf('session') !== -1) {
          sails.config.http.middleware.order.splice(sails.config.http.middleware.order.indexOf('session') + 1, 0, 'cors', 'simpleGraphQLMiddleware');
        } else if (sails.config.http.middleware.order.indexOf('bodyParser') !== -1) {
          sails.config.http.middleware.order.splice(sails.config.http.middleware.order.indexOf('bodyParser') - 1, 0, 'cors', 'simpleGraphQLMiddleware');
        } else {
          sails.config.http.middleware.order.splice(0, 0, 'cors', 'simpleGraphQLMiddleware');
        }
        // console.log(sails.config.http.middleware.order);
      }
    },

    /**
     * Hook initialization
     *
     * @param  {Function} cb
     */
    initialize(cb) {
      // Hook loaded
      return cb();
    },
  };
}
