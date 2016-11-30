/**
 * Hook dependencies
 */
import _ from 'lodash';

export default function simpleGraphQL(sails) {
  return {
    /**
     * Hook defaults
     */
    defaults: {

      __configKey__: {

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
        // Add the http middleware 'passportInit' if no custom middleware exists
        /* if (_.isUndefined(sails.config.http.middleware.passportInit)) {
          sails.config.http.middleware.passportInit = passport.initialize();
        } */

        // Add the http middleware 'passportSession' if no custom middleware exists
        /* if (_.isUndefined(sails.config.http.middleware.passportSession)) {
          sails.config.http.middleware.passportSession = passport.session();
        } */

        // Update middleware order
        /* if (sails.config.http.middleware.order.indexOf('session') !== -1) {
          sails.config.http.middleware.order.splice(sails.config.http.middleware.order.indexOf('session') + 1, 0, 'passportInit', 'passportSession');
        } else if (sails.config.http.middleware.order.indexOf('cookieParser') !== -1) {
          sails.config.http.middleware.order.splice(sails.config.http.middleware.order.indexOf('cookieParser') + 1, 0, 'passportInit', 'passportSession');
        } else {
          sails.config.http.middleware.order.splice(0, 0, 'passportInit', 'passportSession');
        } */
      }
    },

    /**
     * Hook initialization
     *
     * @param  {Function} cb
     */
    initialize(cb) {
      // Only if the http hook was found
      if (sails.hooks.http) {

        // Hook loaded
        return cb();
      }

      // Hook loaded, but without changes
      return cb();
    },
  };
}
