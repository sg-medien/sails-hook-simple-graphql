module.exports = {
  "extends": "airbnb",
  "plugins": [
    "jsx-a11y",
    "import"
  ],
  "env": {
    "browser": true,
    "node": true
  },
  "rules": {
    "valid-typeof": "off",
    "no-underscore-dangle": "off",
    "max-len": ["error", 150, 2, { ignoreComments: true }],
    "no-param-reassign": ["error", { props: false }]
  }
};
