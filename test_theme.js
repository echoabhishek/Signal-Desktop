const fs = require('fs');
const path = require('path');

function testThemeChanges() {
  const standaloneRegistrationPath = path.join(__dirname, 'ts', 'components', 'StandaloneRegistration.tsx');
  const standaloneRegistrationScssPath = path.join(__dirname, 'stylesheets', 'components', 'StandaloneRegistration.scss');
  const manifestScssPath = path.join(__dirname, 'stylesheets', 'manifest.scss');

  // Check if the theme-aware class is added to the StandaloneRegistration component
  const standaloneRegistrationContent = fs.readFileSync(standaloneRegistrationPath, 'utf8');
  if (!standaloneRegistrationContent.includes('rootElement.classList.add(\'theme-aware\')')) {
    console.error('Error: theme-aware class is not added to the StandaloneRegistration component');
    return false;
  }

  // Check if the StandaloneRegistration.scss file exists and contains theme-aware styles
  if (!fs.existsSync(standaloneRegistrationScssPath)) {
    console.error('Error: StandaloneRegistration.scss file is missing');
    return false;
  }
  const standaloneRegistrationScssContent = fs.readFileSync(standaloneRegistrationScssPath, 'utf8');
  if (!standaloneRegistrationScssContent.includes('@media (prefers-color-scheme: dark)')) {
    console.error('Error: StandaloneRegistration.scss does not contain dark theme styles');
    return false;
  }

  // Check for focus states
  if (!standaloneRegistrationScssContent.includes('&:focus')) {
    console.error('Error: Focus states are not defined in StandaloneRegistration.scss');
    return false;
  }

  // Check for disabled states
  if (!standaloneRegistrationScssContent.includes('&:disabled')) {
    console.error('Error: Disabled states are not defined in StandaloneRegistration.scss');
    return false;
  }

  // Check for error messages and validation indicators
  if (!standaloneRegistrationScssContent.includes('.error-message, .validation-indicator')) {
    console.error('Error: Styles for error messages and validation indicators are not defined in StandaloneRegistration.scss');
    return false;
  }

  // Check for phone input specific styles
  if (!standaloneRegistrationScssContent.includes('.phone-input')) {
    console.error('Error: Phone input specific styles are not defined in StandaloneRegistration.scss');
    return false;
  }

  // Check if the StandaloneRegistration.scss is imported in the manifest.scss
  const manifestScssContent = fs.readFileSync(manifestScssPath, 'utf8');
  if (!manifestScssContent.includes('@use \'components/StandaloneRegistration.scss\';')) {
    console.error('Error: StandaloneRegistration.scss is not imported in manifest.scss');
    return false;
  }

  console.log('All theme-related changes have been successfully implemented');
  return true;
}

testThemeChanges();
