/**
 * Creates the "Bruno's Alarm — Tester feedback" Google Form in your Google Drive.
 *
 * How to use (about 1 minute):
 *   1. Go to https://script.google.com → New project.
 *   2. Delete everything in the editor, paste this whole file, click Save.
 *   3. Pick "createTesterFeedbackForm" in the function dropdown and click Run.
 *   4. Google asks you to allow the script to manage your forms — allow it (it's your own script).
 *   5. Open "Execution log": it prints the link to edit the form and the link to send testers.
 */
function createTesterFeedbackForm() {
  var form = FormApp.create("Bruno's Alarm — Tester feedback");
  form.setDescription(
    "Thanks for testing Bruno's Alarm! This takes about 5 minutes. " +
    "The most useful thing you can tell us is whether your alarms rang reliably, and if not, when and how your phone was set up."
  );
  form.setCollectEmail(false);
  form.setProgressBar(true);

  // --- Section 1: Your phone
  form.addSectionHeaderItem()
    .setTitle("Your phone")
    .setHelpText("Alarms behave differently on different phone brands, so this helps us a lot.");

  form.addTextItem()
    .setTitle("Phone brand and model")
    .setHelpText("For example: Samsung A35, OPPO Reno, Pixel 8")
    .setRequired(true);

  form.addTextItem()
    .setTitle("Android version (if you know it)")
    .setHelpText("Settings → About phone");

  form.addMultipleChoiceItem()
    .setTitle("How long have you had the app installed?")
    .setChoiceValues(["Less than 3 days", "3–7 days", "1–2 weeks", "More than 2 weeks"]);

  // --- Section 2: First impressions
  form.addPageBreakItem().setTitle("First impressions");

  form.addMultipleChoiceItem()
    .setTitle("After the intro screens, did you understand what the app does?")
    .setChoiceValues(["Yes, clearly", "Mostly", "Not really"])
    .setRequired(true);

  form.addParagraphTextItem()
    .setTitle("Was anything confusing when you first opened the app?");

  // --- Section 3: Alarms
  form.addPageBreakItem()
    .setTitle("Alarms")
    .setHelpText("The most important part — please answer as accurately as you can.");

  form.addCheckboxItem()
    .setTitle("Which alarms did you use?")
    .setChoiceValues([
      "Bruno's daily alarm (6 AM / 6 PM)",
      "My own alarm times",
      "\"Ring when Bruno goes live\"",
      "None",
    ]);

  form.addMultipleChoiceItem()
    .setTitle("Did your alarms ring on time, every time?")
    .setChoiceValues(["Always", "Mostly", "Sometimes missed", "Never rang"])
    .setRequired(true);

  form.addParagraphTextItem()
    .setTitle("If an alarm was late or didn't ring: when was it supposed to ring?")
    .setHelpText(
      "Date and time if you can, and whether the phone was on silent, Do Not Disturb, battery saver, " +
      "or the app had been swiped away from recent apps."
    );

  form.addMultipleChoiceItem()
    .setTitle("When the alarm rang, did Bruno's video show on your lock screen?")
    .setChoiceValues(["Yes", "No, only a notification", "Didn't notice"]);

  form.addMultipleChoiceItem()
    .setTitle("Did Stop and Snooze work as expected?")
    .setChoiceValues(["Yes", "No (please describe below)"]);

  // --- Section 4: Live and chat
  form.addPageBreakItem().setTitle("Live video and chat");

  form.addMultipleChoiceItem()
    .setTitle("Did you watch Bruno live?")
    .setChoiceValues([
      "Yes, it played well",
      "Yes, but it buffered or froze",
      "Tried, but he wasn't live",
      "Didn't try",
    ]);

  form.addMultipleChoiceItem()
    .setTitle("Did you use the chat (live chat or Bruno's Pack)?")
    .setChoiceValues(["Yes, it worked fine", "Yes, but had problems", "No"]);

  // --- Section 5: Overall
  form.addPageBreakItem().setTitle("Overall");

  form.addScaleItem()
    .setTitle("How likely are you to keep using the app after testing?")
    .setBounds(1, 5)
    .setLabels("Not likely", "Very likely");

  form.addParagraphTextItem()
    .setTitle("Anything broken, annoying, or crashing?")
    .setHelpText("Please say what you were doing when it happened.");

  form.addParagraphTextItem()
    .setTitle("One thing you'd change or add?");

  form.addTextItem()
    .setTitle("Can we contact you about your answers? (optional)")
    .setHelpText("Leave an email only if you're happy for us to follow up.");

  Logger.log("Edit the form: " + form.getEditUrl());
  Logger.log("Send this link to testers: " + form.getPublishedUrl());
}
