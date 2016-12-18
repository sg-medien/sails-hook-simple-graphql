/* Sorry for this dirty and chaotic code, i will clean this soon! But the base of this code works :) */

import _ from 'lodash';
import Promise from 'bluebird';
import DataLoader from 'dataloader';
import pluralize from 'pluralize';
import {
  GraphQLID,
  GraphQLBoolean,
  GraphQLFloat,
  GraphQLInt,
  GraphQLList,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString,
  GraphQLEnumType,
  // GraphQLInterfaceType,
  GraphQLNonNull,
  // isTypeOf
} from 'graphql';
import {
  GraphQLEmail,
  GraphQLURL,
  GraphQLDateTime,
  GraphQLUUID,
} from 'graphql-custom-types';

// import { nodeDefinitions, fromGlobalId, globalIdField } from 'graphql-relay';
import GraphQLMixed from './utils/customTypes/mixed';
import GraphQLBuffer from './utils/customTypes/buffer';
import helper from './utils/helper';

const global = {
  models: null,
  types: {},
  queries: {},
  enums: {},
  counter: 0,
};

let req;
let findDataLoader;
let findOneDataLoader;

/*const { nodeInterface, nodeField } = nodeDefinitions((globalId) => {

 return new Promise((next, error) => {
 const idInfo = fromGlobalId(globalId);

 console.log(idInfo);
 return resolveFindOne(global.models[idInfo.type.toLowerCase()], null, { id: idInfo.id }).then(function(data){ console.log('idInfo', idInfo); return next({ type: idInfo.type.toLowerCase(), data }); }).catch(function(err){ return error(err); });


 });
 // {type, id}




 },
 (obj) => {

 console.log('obj.type', obj.type);

 return global.types[obj.type] ? global.types[obj.type] : null;
 }
 );*/

/*const nodeDefinitions = GraphQLRelay.nodeDefinitions(function(globalId) {
 const idInfo = GraphQLRelay.fromGlobalId(globalId);

 console.log(idInfo);


 if (idInfo.type == 'User') {
 return db.getUser(idInfo.id)
 } else if (idInfo.type == 'Widget') {
 return db.getWidget(idInfo.id)
 }
 return null;
 }); */

//console.log(nodeDefinitions);

const utilArgs = {
  sort: {
    type: GraphQLString,
  },
  page: {
    type: GraphQLInt,
  },
  limit: {
    type: GraphQLInt,
  },
};

// TODO: CLEAN, ADD COMMENT
function normalizeSort(model, sort) {
  const normalizedSort = {};

  if (sort) {
    const sortArray = sort.split(',');

    _.forEach(sortArray, (value) => {
      let dir = 1;
      let sortValue = _.trim(value);

      // Get sort direction
      if (sortValue.charAt(0) === '-') {
        dir = 0;
      }

      // Kill sort identifier
      while (sortValue.charAt(0) === '-' || sortValue.charAt(0) === '+') {
        sortValue = _.trim(sortValue.substr(1));
      }

      // Check if the field for the sorting exists and if yes, add it to the sort object
      if (
        sortValue !== '' &&
        !_.isUndefined(model._attributes) &&
        !_.isUndefined(model._attributes[sortValue]) &&
        !_.isFunction(model._attributes[sortValue]) &&
        _.isObject(model._attributes[sortValue])
      ) {
        normalizedSort[sortValue] = dir;
      }
    });
  }

  return normalizedSort;
}

// TODO: CLEAN, ADD COMMENT
function normalizePage(page) {
  let normalizedPage = 1;

  if (page) {
    normalizedPage = page;
  }

  return normalizedPage;
}

// TODO: CLEAN, ADD COMMENT
function normalizeLimit(limit) {
  let normalizedLimit = 30;

  if (limit) {
    normalizedLimit = limit;
  }

  return normalizedLimit;
}

const utilFields = {
  hasMore: {
    type: GraphQLBoolean,
  },
};


/**
 * Get all `criteria` from an array which are valid for a given model.
 *
 * Structure of an array value:
 * (`criteria modifier`)?`value` e.g. `2`, `=2`, `!2`, `<=10`
 *
 * Available criteria modifiers:
 * Equal:                 ``, `=`, `==`         (Note: You can pass multiple values separated by a comma e.g. `=1,2,3` means '1' or '2' or '3')
 * Not equal:             `!`, `!=`             (Note: You can pass multiple values separated by a comma e.g. `!1,2,3` means not '1' and '2' and '3')
 * Less than:             `<`
 * Less than or equal:    `<=`
 * Greater than:          `>`
 * Greater than or equal: `>=`
 * Starts with:           `=>`
 * Ends with:             `=<`
 * Contains:              `@`, `=@`
 * Like:                  `%`, `=%`, `*`, `=*`  (Note: You can use `%` or `*` anywhere in the search phrase to mark them as unknown part of the search phrase)
 * Between:               `><`                  (Note: You can separate the between start and end value with a comma e.g. `><1,9`)
 *
 * If you would like to search without a modifier for a phrase which begins with a modifier you can escape your search phrase with a `\` at the beginning e.g.:
 *
 * Without escaping:
 * `@domain.com` finds `email@domain.com`, `domain.com` and 'domain.com/path'
 *
 * With escaping:
 * `\@domain.com` finds nothing because the values `email@domain.com`, `domain.com` and 'domain.com/path' are not exactly `@domain.com`
 *
 * If you want like to search for a real `%` or `*` during you set the like modifier, just escape it with a `\`.
 *
 * @param {Object} model The model object.
 * @param {Array} criteria The criteria array.
 *
 * @return {Object} The parsed criteria.
 */
function getModelFilters(model, criteria) {
  let where = criteria;

  // Remove certain criteria
  if (where && req.options && _.isArray(req.options.remove) && req.options.remove.length) {
    _.forEach(where, (value, name) => {
      if (req.options.remove.indexOf(name) !== -1 || req.options.remove.indexOf(`${model.identity}.${name}`) !== -1) {
        delete where[name];
      }
    });
  }

  // Get models criteria
  let modelWhere = {};
  if (req.options &&
    req.options.models &&
    req.options.models[model.identity] &&
    req.options.models[model.identity].where &&
    _.isObject(req.options.models[model.identity].where)
  ) {
    modelWhere = req.options.models[model.identity].where;
  }

  // Merge `req.options.where` and `where` and return
  where = _.merge({}, req.options.where || {}, modelWhere, where) || undefined;

  const modifierRegExp = '(=(=|<|>|%|\\*|@)?|!(=)?|@|%|\\*|<(=)?|>(=|<)?)';
  const modifierTranslations = {
    '=': false,
    '==': false,
    '!': 'not',
    '!=': 'not',
    '@': 'contains',
    '=@': 'contains',
    '%': 'like',
    '=%': 'like',
    '*': 'like',
    '=*': 'like',
    '=<': 'endsWith',
    '=>': 'startsWith',
    '><': ['>=', '<='],
  };

  // Remove criteria which are not available in the model attributes
  let newWhere = {};
  _.forEach(where, (value, name) => {
    if (
      _.isString(name) && _.trim(name) !== '' &&
      !_.isUndefined(model._attributes) &&
      !_.isUndefined(model._attributes[name]) &&
      !_.isFunction(model._attributes[name]) &&
      _.isObject(model._attributes[name])
    ) {
      newWhere[name] = value;
    }
  });
  where = newWhere;

  // Parse criteria for modifiers
  newWhere = {};
  _.forEach(where, (value, name) => {
    let modifier = false;
    let whereValue = _.trim(value);

    const match = whereValue.match(new RegExp(`^${modifierRegExp}`));
    if (match) {
      modifier = match[0];
      modifier = !_.isUndefined(modifierTranslations[modifier]) ? modifierTranslations[modifier] : modifier;
      whereValue = _.trim(whereValue.replace(new RegExp(`^${modifierRegExp}`), ''));

      // Replace * to % if chars not escaped and modfier is `like`
      if (modifier === 'like' && whereValue !== '') {
        whereValue = whereValue.replace(/([^\\]+|^)\*/g, '$1%');
      }
    } else if (whereValue.match(new RegExp(`^\\\\\\s*${modifierRegExp}`))) {
      whereValue = _.trim(whereValue.replace(new RegExp('^\\\\\\s*'), ''));
    }

    if ((modifier === false || (_.isString(modifier) && modifier === 'not') || _.isArray(modifier)) && whereValue.match(/,/)) {
      const whereValueArray = whereValue.split(',');

      _.forEach(whereValueArray, (whereValueEle, index) => {
        whereValueArray[index] = _.trim(whereValueEle);

        if (whereValueArray[index].toLowerCase() === 'false') {
          whereValueArray[index] = 0;
        } else if (whereValueArray[index].toLowerCase() === 'true') {
          whereValueArray[index] = 1;
        } else if (
          whereValueArray[index].toLowerCase() === 'null' ||
          whereValueArray[index].toLowerCase() === 'undefined' ||
          whereValueArray[index] === ''
        ) {
          whereValueArray[index] = null;
        } else if (
          !_.isUndefined(model._attributes) &&
          !_.isUndefined(model._attributes[name]) &&
          !_.isUndefined(model._attributes[name].type) &&
          _.isString(model._attributes[name].type) &&
          (
            model._attributes[name].type.toLowerCase() === 'date' ||
            model._attributes[name].type.toLowerCase() === 'datetime'
          )
        ) {
          const date = helper.tryNewDateFromUnixTimestamp(whereValueArray[index]) || helper.tryNewDateFromString(whereValueArray[index]);

          if (date) {
            whereValueArray[index] = date;
          }
        }
      });

      whereValue = _.uniq(whereValueArray);
    } else if (whereValue.toLowerCase() === 'false') {
      whereValue = 0;
    } else if (whereValue.toLowerCase() === 'true') {
      whereValue = 1;
    } else if (whereValue.toLowerCase() === 'null' || whereValue.toLowerCase() === 'undefined' || whereValue === '') {
      whereValue = modifier === 'like' ? '%' : null;
    } else if (
      !_.isUndefined(model._attributes) &&
      !_.isUndefined(model._attributes[name]) &&
      !_.isUndefined(model._attributes[name].type) &&
      _.isString(model._attributes[name].type) &&
      (
        model._attributes[name].type.toLowerCase() === 'date' ||
        model._attributes[name].type.toLowerCase() === 'datetime'
      )
    ) {
      const date = helper.tryNewDateFromUnixTimestamp(whereValue) || helper.tryNewDateFromString(whereValue);

      if (date) {
        whereValue = date;
      }
    }

    if (!modifier) {
      newWhere[name] = whereValue;
    } else if (_.isArray(modifier)) {
      newWhere[name] = {};

      _.forEach(modifier, (modifierValue, index) => {
        const modWhereValue = _.isString(whereValue) ? whereValue : (!_.isUndefined(whereValue[index]) ? whereValue[index] : false);

        if (modWhereValue !== false) {
          newWhere[name][modifierValue] = modWhereValue;
        }
      });
    } else if (_.isString(modifier)) {
      newWhere[name] = {};
      newWhere[name][modifier] = whereValue;
    }
  });
  where = newWhere;

  // Remove any properties with undefined values and trim values if type is string
  newWhere = {};
  _.forEach(where, (value, name) => {
    if (!_.isUndefined(value)) {
      newWhere[name] = _.isString(value) ? _.trim(value) : value;
    }
  });
  where = newWhere;

  return where;
}

// TODO: MORE EASY, CLEAN, ADD COMMENT
function normalizeType(type, data) {
  switch (type.toLowerCase()) {
    case 'primary':
      return new GraphQLNonNull(GraphQLID);
    case 'enum': {
      if (!global.enums[data.name]) {
        global.enums[data.name] = new GraphQLEnumType(data);
      }
      return global.enums[data.name];
    }
    case 'email':
      return GraphQLEmail;
    case 'integer':
      return GraphQLInt;
    case 'float':
    case 'number':
      return GraphQLFloat;
    case 'date':
    case 'datetime':
      return GraphQLDateTime;
    case 'boolean':
      return GraphQLBoolean;
    case 'array':
      return new GraphQLList(GraphQLMixed);
    case 'json':
      return GraphQLMixed;
    case 'objectid':
      return GraphQLID;
    case 'uuid':
      return GraphQLUUID;
    case 'url':
      return GraphQLURL;
    case 'binary':
      return GraphQLBuffer;
    default:
      return GraphQLString;
  }
}

// TODO: ADD COMMENT
function buildFilterArgs(model) {
  const builtFilterArgs = {};

  _.forEach(model._attributes, (field, name) => {
    if (!_.isFunction(field) && _.isObject(field)) {
      builtFilterArgs[name] = {
        type: GraphQLMixed,
        description: field.description,
      };
    }
  });

  return builtFilterArgs;
}

// TODO: ADD COMMENT
function buildFields(model) {
  const builtFields = {};

  _.forEach(model._attributes, (field, name) => {
    if (field.type) {
      let type = field.type;
      let data;
      if (field.primaryKey && field.unique) {
        type = 'primary';
        //data = model.globalId || (name.substr(0, 1).toUpperCase() + name.substr(1));
      } else if (type === 'string') {
        if (field.email) {
          type = 'email';
        } else if (field.uuid || field.uuidv3 || field.uuidv4) {
          type = 'uuid';
        } else if (field.url) {
          type = 'url';
        } else if ((field.in && _.isArray(field.in)) || (field.enum && _.isArray(field.enum))) {
          type = 'enum';
          data = {
            name: model.globalId + (name.substr(0, 1).toUpperCase() + name.substr(1)),
            values: {},
          };

          const enumArr = field.in || field.enum;
          _.forEach(enumArr, (enumValue) => {
            data.values[enumValue] = { value: enumValue };
          });
        }
      }

      builtFields[name] = {
        type: normalizeType(type, data),
        description: field.description,
      };

      /*if (type === 'primary') {
       builtFields[name] = globalIdField();
       } else {
       builtFields[name] = {
       type: normalizeType(type, data),
       description: field.description,
       };
       }*/
    }
  });

  return builtFields;
}

// TODO: ADD COMMENT
function buildAssociations(model, models) {
  const builtAssociations = {};

  if (model) {
    _.forEach(model.associations, (association) => {
      if (association.model && models[association.model] && models[association.model].primaryKey) {
        const primaryKey = models[association.model].primaryKey;

        builtAssociations[association.alias] = {
          type: global.types[association.model],
          description: (
            (
              model._attributes &&
              model._attributes[association.alias] &&
              model._attributes[association.alias].description
            ) ||
            (
              models[association.model]._attributes &&
              models[association.model]._attributes[primaryKey] &&
              models[association.model]._attributes[primaryKey].description
            )
          ),
          args: _.merge({}, buildFilterArgs(models[association.model]), utilArgs),
          resolve: (parentObj, args, ...others) => {
            const parentArgs = {};
            parentArgs[primaryKey] = parentObj[association.alias];

            return global.queries[association.model].resolve(parentObj, _.merge({}, args, parentArgs), ...others);
          },
        };
      } else if (association.collection && models[association.collection] && models[association.collection].primaryKey) {
        const primaryKey = models[association.collection].primaryKey;

        builtAssociations[association.alias] = {
          type: new GraphQLList(global.types[association.collection]),
          description: (
            (
              model._attributes &&
              model._attributes[association.alias] &&
              model._attributes[association.alias].description
            ) ||
            (
              models[association.collection] &&
              models[association.collection]._attributes &&
              models[association.collection]._attributes[association.via] &&
              models[association.collection]._attributes[association.via].description
            )
          ),
          args: _.merge({}, buildFilterArgs(models[association.collection]), utilArgs),
          resolve: (parentObj, args, ...others) => {
            const parentArgs = {};
            parentArgs[association.via] = parentObj[primaryKey];

            return global.queries[pluralize(association.collection)].resolve(parentObj, _.merge({}, args, parentArgs), ...others);
          },
        };
      }
    });
  }

  return builtAssociations;
}

// TODO: ADD COMMENT
function buildTypes(models) {
  const builtTypes = {};

  _.forEach(models, (model, name) => {
    builtTypes[name] = new GraphQLObjectType({
      name: model.globalId || (name.substr(0, 1).toUpperCase() + name.substr(1)),
      description: model.description,
      fields() {
        return _.merge({}, buildFields(model), buildAssociations(model, models), utilFields);
      },
      //interfaces: [nodeInterface],
      //isTypeOf: function(obj) { console.log('obj type inner', obj); return obj;/* return obj instanceof db.User*/ },
    });
    global.types[name] = builtTypes[name];
  });

  return builtTypes;
}

// TODO: ADD COMMENT
function resolveFindOne(model, parentObj, { ...args }) {
  const key = {
    model: model.identity,
    args,
  };

  return findOneDataLoader.load(JSON.stringify(key));
}

// TODO: ADD COMMENT
function resolveFind(model, parentObj, { ...args }) {
  const key = {
    model: model.identity,
    args,
  };

  return findDataLoader.load(JSON.stringify(key));
}

// TODO: ADD COMMENT
function buildQueries(types, models) {
  const builtQueries = {};

  _.forEach(types, (type, name) => {
    const model = models[name];

    builtQueries[name] = {
      type,
      args: _.merge({}, buildFilterArgs(model), utilArgs),
      resolve: (...para) => resolveFindOne(model, ...para),
    };
    global.queries[name] = builtQueries[name];

    builtQueries[pluralize(name)] = {
      type: new GraphQLList(type),
      args: _.merge({}, buildFilterArgs(model), utilArgs),
      resolve: (...para) => resolveFind(model, ...para),
    };
    global.queries[pluralize(name)] = builtQueries[pluralize(name)];
  });

  return builtQueries;
}

// TODO: CLEAN, ADD COMMENT, ADD MUTATIONS
function buildSchema(models) {
  const types = buildTypes(models);
  const queries = buildQueries(types, models);

  global.models = models;

  const createdSchema = new GraphQLSchema({
    query: new GraphQLObjectType({
      name: 'Query',
      fields() {
        return queries;
        /*return _.merge({}, queries, {
         node: nodeField,
         });*/
      },
    }),
  });

  return createdSchema;
}

export default {
  createSchema(models, reqObj) {
    if (!_.isUndefined(reqObj)) {
      req = _.merge({}, {
        options: {
          where: {},
          models: {},
          remove: [],
        },
      }, reqObj);
    }

    findOneDataLoader = new DataLoader(keys => new Promise((resolve) => {
      const findOnePromise = key => new Promise((findOneResolve, findOneReject) => {
        const keyObj = helper.tryParseJSON(key);
        const { model, args } = keyObj;

        if (!model || !global.models[model]) return findOneReject(new Error(`Invalid model (passed: "${model}").`));

        const Model = global.models[model];
        const { sort, page, limit, ...criteria } = args;

        return Model
          .find(getModelFilters(Model, criteria))
          .sort(normalizeSort(Model, sort))
          .paginate({ page: normalizePage(page), limit: normalizeLimit(limit) })
          .then((results) => {
            const toJsonResult = (results && results[0] && typeof results[0].toJSON === 'function') ? results[0].toJSON() : null;

            return findOneResolve(toJsonResult);
          })
          .catch(e => findOneReject(e));
      });

      return resolve(Promise.all(keys.map(key => findOnePromise(key))));
    }));

    findDataLoader = new DataLoader(keys => new Promise((resolve) => {
      const findPromise = key => new Promise((findResolve, findReject) => {
        const keyObj = helper.tryParseJSON(key);
        const { model, args } = keyObj;

        if (!model || !global.models[model]) return findReject(new Error(`Invalid model (passed: "${model}").`));

        const Model = global.models[model];
        const { sort, page, limit, ...criteria } = args;

        return Model
          .find(getModelFilters(Model, criteria))
          .sort(normalizeSort(Model, sort))
          .paginate({ page: normalizePage(page), limit: normalizeLimit(limit) })
          .then((results) => {
            Model
              .count(getModelFilters(Model, criteria))
              .skip(normalizePage(page) * normalizeLimit(limit))
              .exec((err, hasMore) => {
                if (err) return findReject(err);

                const toJsonResult = [];

                _.forEach(results, (result) => {
                  toJsonResult.push((result && typeof result.toJSON === 'function') ? _.merge({}, result.toJSON(), { hasMore: true }) : null);
                });

                if (toJsonResult.length) {
                  toJsonResult[toJsonResult.length - 1].hasMore = hasMore > 0;
                }

                return findResolve(toJsonResult);
              });
          })
          .catch(e => findReject(e));
      });

      return resolve(Promise.all(keys.map(key => findPromise(key))));
    }));

    return buildSchema(models);
  },
};
