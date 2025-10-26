# Accessibility Compliance Checklist



This comprehensive checklist covers 50 critical checkpoints based on the Web Content Accessibility Guidelines (WCAG) 2.1 and 2.2 Level AA requirements.

1. Perceivable (Content must be detectable and distinguishable)

#

Requirement

Details & WCAG Reference

1

Alternative Text (Alt Text)

All meaningful images, charts, and graphics have descriptive alt text. (1.1.1)

2

Decorative Images

Decorative images have an empty alt attribute (alt=""). (1.1.1)

3

Text/Background Contrast

Text and background colors meet a minimum contrast ratio of 4.5:1 (3:1 for large text). (1.4.3)

4

Non-Text Contrast

User interface components (e.g., input borders, icons, focus indicators) have a minimum contrast ratio of 3:1. (1.4.11)

5

Do Not Use Color Alone

Color is not the sole means of conveying information, indicating an action, or distinguishing a visual element. (1.4.1)

6

Captions (Prerecorded)

Synchronized captions are provided for all prerecorded video content with audio. (1.2.2)

7

Audio Description

An audio description or transcript is provided for prerecorded videos where crucial information is visual only. (1.2.5)

8

Captions (Live)

Captions are provided for live streaming media. (1.2.4)

9

Reflow Content (Responsiveness)

Content can adapt to a screen width of 320 pixels without requiring horizontal scrolling. (1.4.10)

10

Text Resizing

Text can be resized up to 200% without loss of content or functionality. (1.4.4)

11

Avoid Images of Text

Actual text is used and styled with CSS, instead of using text embedded in images. (1.4.5)

12

Logical Reading Sequence

The sequence in which content is presented in code (DOM order) is logical and meaningful. (1.3.2)

13

Structural Markup

Proper semantic HTML elements are used to convey content structure (e.g., <ul> for lists, <blockquote> for quotes). (1.3.1)

14

Data Table Markup

Data tables use appropriate elements to identify headers (<th>) and associate data cells. (1.3.1)

15

Audio Control

Any audio that plays automatically can be paused, stopped, or muted. (1.4.2)

16

Instructions Don't Rely on Senses

Instructions do not rely solely on shape, size, location, or sound (e.g., "click the green button" is fine, but "click the button on the left" is not). (1.3.3)

2. Operable (Interface and navigation must be functional for all users)

#

Requirement

Details & WCAG Reference

17

Keyboard Accessible

All functionality is operable using only the keyboard. (2.1.1)

18

No Keyboard Trap

Users can navigate away from all elements using only the keyboard (e.g., using Tab and Shift+Tab). (2.1.2)

19

Visible Focus Indicator

There is a clear, visible focus indicator (outline) on the element that currently has keyboard focus. (2.4.7)

20

Bypass Blocks (Skip Link)

A "Skip to Main Content" link is provided at the top of the page for keyboard users. (2.4.1)

21

Clear Page Titles

Every page has a unique, concise, and descriptive title in the <title> tag. (2.4.2)

22

Logical Focus Order (Tab Order)

The order in which interactive elements receive focus is logical and meaningful. (2.4.3)

23

Descriptive Link Text

The purpose of every link is clear from its text alone or its programmatically determined context. (2.4.4)

24

Headings Follow Hierarchy

Headings (<h1> through <h6>) are used strictly to organize content hierarchy and are not skipped. (1.3.1)

25

Target Size (Minimum)

Interactive targets (buttons, links) are at least 24x24 CSS pixels, with specified exceptions. (2.5.8)

26

Multiple Ways to Navigate

Users can find information using at least two methods (e.g., navigation menu, search, sitemap). (2.4.5)

27

Flashing/Animation Control

Moving, blinking, or scrolling content that lasts more than 5 seconds can be paused, stopped, or hidden. (2.2.2)

28

No Excessive Flashing

Content does not flash more than three times per second. (2.3.1)

29

Pointer Cancellation

Actions triggered by a single pointer (tap/click) execute on the up-event (release) and are reversible or interruptible. (2.5.2)

30

Time Limits Adjustable

Users can extend, adjust, or turn off time limits unless the event is real-time. (2.2.1)

31

Content on Hover/Focus Control

Content displayed on hover or focus is dismissible, hoverable, and persistent until dismissed. (1.4.13)

32

Avoid Directional Gestures

Functionality that relies on path-based or multi-point gestures (like drawing a shape) has an accessible, single-pointer alternative. (2.5.1)

3. Understandable (Information and operation must be clear and predictable)

#

Requirement

Details & WCAG Reference

33

Language of Page Declared

The default human language is programmatically identified in the <html> tag (e.g., <html lang="en">). (3.1.1)

34

Consistent Navigation

Navigation menus and standard controls are presented in the same order on every page. (3.2.3)

35

Consistent Identification

Components with the same function across the site are consistently labeled and identified. (3.2.4)

36

Error Identification

Input errors in forms are clearly identified and described to the user in text. (3.3.1)

37

Labels or Instructions

All form input fields have clear, programmatically associated labels (<label for="id">). (3.3.2)

38

Error Suggestion

When an input error is detected, suggestions for correction are provided (e.g., "The password must contain a number"). (3.3.3)

39

Input Purpose Identified (Autofill)

Input fields that collect certain user information use the autocomplete attribute to identify their purpose. (1.3.5)

40

Context Change on Request

Any change of context (e.g., opening a new window, submitting a form) is only initiated by user request or warning. (3.2.1, 3.2.2)

41

Clear and Simple Language

Content is written as clearly and simply as possible, avoiding unnecessary jargon. (3.1.5 - AAA, but recommended)

42

Error Prevention (Commitments)

For legal or financial data, users can review, reverse, or confirm submissions to prevent errors. (3.3.4)

43

Consistent Help

Help options (support links, contact info, chatbot) are presented consistently and predictably. (3.2.6)

44

Accessible Authentication

Authentication methods (logins) do not rely on a single cognitive test unless an accessible alternative is provided. (3.3.8)

4. Robust (Content must be reliably interpreted by a variety of technologies)

#

Requirement

Details & WCAG Reference

45

Valid HTML

The code is free of major structural parsing errors (which are bugs that can confuse assistive technology). (4.1.1)

46

Programmatic Name, Role, Value

User interface components (native and custom) expose their name, role, state, and value to assistive technologies. (4.1.2)

47

ARIA Usage

ARIA is only used when native HTML cannot achieve the correct semantic meaning, and it is used correctly (e.g., ARIA attributes match element roles). (4.1.2)

48

Status Messages

Status updates that don't take focus (e.g., a "Saving..." notification) are announced using ARIA live regions. (4.1.3)

49

Orientation Independence

The website works and is usable in both portrait and landscape screen orientations. (1.3.4)

50

Compatibility Testing

The site is tested with multiple assistive technologies (e.g., NVDA, JAWS, VoiceOver) and different browsers. (4.1.2)