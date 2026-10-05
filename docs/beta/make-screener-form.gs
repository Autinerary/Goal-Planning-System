/**
 * Builds the beta sign-up Google Form from screener.md, with its responses
 * going to a new Google Sheet (the restricted research spreadsheet).
 *
 * 1. Signed in to the Google account that should own the form, open
 *    https://script.google.com and click "New project".
 * 2. Replace everything in the editor with this file, then click Run.
 * 3. Allow access when Google asks (it needs Forms and Sheets).
 * 4. The log (View > Logs, or the panel at the bottom) prints the form's
 *    link for people, its edit link, and the responses sheet.
 *
 * Put the form's link (the one for people) in outreach.md where it says
 * "Session sign-up form". Keep the sheet restricted to the research team
 * (see README.md, "Keeping testers' information safe").
 */
function makeScreenerForm() {
  var form = FormApp.create('Help test Autinerary');
  form.setDescription(
    'Autinerary is a free app that turns a goal into a step-by-step plan, and helps you find services and ' +
    'places that fit how you work. It is built for neurodivergent people and the people who support them, ' +
    'and it is in beta.\n\n' +
    'We are looking for testers aged 18 or over. You can:\n' +
    '- join one 40-minute video session between 12 and 23 October, where you try a few things in the app ' +
    'while you talk us through them, or\n' +
    '- use Autinerary for 30 days (12 October to 10 November), and answer a short question now and then, or\n' +
    '- both.\n\n' +
    'This form takes about 3 minutes. Only your age, your email and the agreement at the end are required. ' +
    'How we handle your answers is at the end.');
  form.setCollectEmail(false);          // question 11 asks for it instead
  form.setLimitOneResponsePerUser(false); // limiting makes people sign in to Google
  form.setProgressBar(true);
  form.setConfirmationMessage('Thank you. We will email you about next steps from aayush@autinerary.ca.');

  // 1. Age, which decides where the form goes next.
  var age = form.addMultipleChoiceItem().setTitle('Are you 18 or older?').setRequired(true);

  var main = form.addPageBreakItem().setTitle('About you');

  form.addCheckboxItem().setTitle('Who would you use Autinerary for?')
    .setChoiceValues(['Myself', 'My child', 'Another family member', 'Someone I teach, support or work with',
                      "I'm an ally, or just learning"]);

  form.addMultipleChoiceItem().setTitle('Do you consider yourself neurodivergent?')
    .setHelpText('We ask so we can hear from a mix of people. Your answer is kept in our research notes only, ' +
                 'under a code instead of your name. It never goes into the app.')
    .setChoiceValues(['Yes', 'No', 'Not sure', 'Prefer not to say']);

  form.addCheckboxItem().setTitle("If you'd like to, tell us more.")
    .setChoiceValues(['Autism', 'ADHD', 'Dyslexia', 'Something else', 'Prefer not to say']);

  form.addMultipleChoiceItem().setTitle('What would you like to do?')
    .setChoiceValues(['One 40-minute video session', 'Use Autinerary for 30 days', 'Both']);

  form.addCheckboxItem().setTitle('What would you use it on?')
    .setChoiceValues(['iPhone', 'Android phone', 'Computer', 'Tablet']);

  form.addCheckboxItem().setTitle('When could you do a session?')
    .setHelpText('Only needed for a session. Times are in Eastern Time.')
    .setChoiceValues(['Weekday mornings', 'Weekday afternoons', 'Weekday evenings', 'Weekends']);

  form.addCheckboxItem().setTitle('Is there anything that would make a session easier for you?')
    .setChoiceValues(['Written instructions as well as spoken ones', 'Captions', 'Keeping my camera off',
                      'Breaks when I need them', 'More time for each part', 'A support person with me'])
    .showOtherOption(true);

  form.addMultipleChoiceItem().setTitle('Where did you hear about this?')
    .setChoiceValues(['Riipen', 'Reddit', 'TikTok', 'Instagram', 'Facebook', 'LinkedIn', 'A community organization',
                      'A parent group', 'A school or teacher', 'A friend or family member'])
    .showOtherOption(true);

  form.addTextItem().setTitle('What should we call you?');

  form.addTextItem().setTitle('Your email address').setRequired(true)
    .setHelpText('We use it only to arrange your session or send you the trial link.')
    .setValidation(FormApp.createTextValidation().requireTextIsEmail()
      .setHelpText('Please enter an email address.').build());

  form.addCheckboxItem().setTitle('Agreement').setRequired(true)
    .setHelpText("Before your session we'll send you a short description of what taking part involves, to " +
                 'agree to. How Autinerary handles your information: https://app.autinerary.ca/privacy . ' +
                 'Questions: aayush@autinerary.ca')
    .setChoiceValues(['I agree to be contacted about Autinerary beta testing.']);

  // Under 18: a closing section, then the form ends.
  var under18 = form.addPageBreakItem().setTitle('Thank you')
    .setHelpText('Autinerary is only for people 18 and over for now.');
  // Finishing "About you" submits, rather than running on into the closing section.
  under18.setGoToPage(FormApp.PageNavigationType.SUBMIT);

  age.setChoices([age.createChoice('Yes', main), age.createChoice('No', under18)]);

  var sheet = SpreadsheetApp.create('Autinerary beta sign-ups (restricted)');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, sheet.getId());

  Logger.log('Form for people: ' + form.getPublishedUrl());
  Logger.log('Edit the form:   ' + form.getEditUrl());
  Logger.log('Responses sheet: ' + sheet.getUrl());
}
