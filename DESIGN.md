# Food Webapp design context

## Product

An everyday recipe, cooking and shopping companion. The primary devices are phones in kitchens and grocery stores, with desktop planning support. English, native browser input/select behavior and system fonts are intentional. No external font requests.

## Visual direction

Fresh garden greens, pale celery surfaces, white recipe cards, dark herb text and restrained amber keyboard focus. A grocery list reads like a useful shopping slip: names first, optional amounts/notes beneath, checkboxes within easy reach. Avoid dashboard statistics, decorative gradients and oversized branding.

## Tokens

The runtime source of truth is `frontend/css/main.css`'s canonical token block. Brand `--color-primary` #315d48; dark brand #244736; background #f7f8f3; surface #ffffff; text #25342c; secondary text #5e6c62; border #d9e0d5. Body typography uses the existing system sans stack; headings use weight/spacing for emphasis. Existing spacing scale 4/8/16/24/32px is retained. Radius 8/12/18px for controls/cards/dialogs. No generated token adapter.

## Components

`ui.js`: API failures, status messages, native-dialog confirmation, legacy-overlay focus containment. `reorder.js`: pointer drag and visible button alternatives. `main.css`: shared buttons, inputs, states, navigation, cards. Keep API identity separate from visual order. Native selects use OS-owned popups. Search clears immediately.

## Accessibility

Visible focus, semantic buttons/links, 44px control targets, large shopping checkboxes, text status in addition to color, reduced motion. Pointer drags have move-up/down buttons. Forms retain failures and use inline validation. Modal dialogs return focus.

## Boundaries and review

Warm and welcoming comes from useful spacing, calm green surfaces and clear food content; never add fake recipes. Screen layout scrolls naturally. No root fixed-height containment. Test 390px phone, 768px tablet and 1280px desktop before acceptance.
