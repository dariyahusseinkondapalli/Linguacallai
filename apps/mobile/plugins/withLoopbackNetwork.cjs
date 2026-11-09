/* global require, module */
const { withAndroidManifest, withDangerousMod, withAppBuildGradle } = require('@expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');
module.exports = config => {
  config = withAndroidManifest(config, value => {
    value.modResults.manifest.application[0].$['android:networkSecurityConfig'] = '@xml/network_security_config';
    return value;
  });
  config = withAppBuildGradle(config, value => {
    if (!value.modResults.contents.includes('abiFilters "arm64-v8a"')) {
      value.modResults.contents = value.modResults.contents.replace('defaultConfig {', 'defaultConfig {\n        ndk { abiFilters "arm64-v8a" }');
    }
    return value;
  });
  return withDangerousMod(config, ['android', async value => {
    const directory = path.join(value.modRequest.platformProjectRoot, 'app/src/main/res/xml');
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'network_security_config.xml'), '<?xml version="1.0" encoding="utf-8"?><network-security-config><base-config cleartextTrafficPermitted="false"/><domain-config cleartextTrafficPermitted="true"><domain includeSubdomains="false">localhost</domain><domain includeSubdomains="false">127.0.0.1</domain></domain-config></network-security-config>');
    return value;
  }]);
};
