# Pantry design system

## Direction and authority

The owner's screenshot feedback requests a cohesive, polished UI with much less filler copy. Subsequent direction from Brooke explicitly requests a cutesy design, light pastel colors, and small illustrated food icons. These choices supersede the earlier green/plain-HTML design. React + Vite + Material UI is explicitly authorized.

## Visual system

- **Character:** a cheerful personal recipe notebook; compact, tidy and useful. Quiet pastel surfaces carry the playful character while dark text, consistent spacing and familiar controls preserve clarity.
- **Palette:** paper #FFFCF9; ink #433A46; secondary ink #756A76; accessible rose #A24B66 for active controls; blush #FBE9EE, mint #E7F1E9, lavender #EFE9F8, butter #FFF2D7 and peach #FCEADB for panels/illustration tiles. Decorative pastel colors never carry essential text without dark ink.
- **Type:** locally hosted DM Sans for controls/body, locally hosted Quicksand for headings and the Pantry wordmark. No external font calls. Compact headings replace introductory slogans.
- **Shape and density:** 16px cards, 12px controls, 8px spacing base; 16px phone gutters and 24px larger gutters. Grocery rows 64px in planning, 78px in shopping. Icon actions have 40px hitboxes and checkboxes have padded targets.
- **Illustration:** original soft gouache/pencil food atlas, used as small decorative icons. Recipe cards anchor images and text to the left. Recipe meal choices are Breakfast, Lunch, Dinner and Dessert (or unset). Fallback illustrations follow the meal category: bread for breakfast, avocado for lunch, bowl for dinner, strawberry for dessert. Legacy/imported category strings remain stored until explicitly changed, with recognized aliases mapped for display/filtering; unrecognized values display as uncategorized. Stable food illustrations distinguish lists and intentional recipe placeholders; actual uploaded recipe photos remain authoritative. No sample recipes or fabricated food photography are inserted.

## Runtime owners

`frontend/src/theme.js` owns Material UI tokens and component variants. `styles.css` contains only document baseline, safe areas, scrollbar, reduced motion, print and focus rules. No old CSS file is loaded. MUI owns menus, focus management, dialogs, forms and feedback. dnd-kit owns pointer/touch/keyboard dragging and announcements, with move-up/down menu alternatives.

## Behavior

Recipes, lists and photos share one compact header and mobile bottom navigation. Full page recipe detail/editing preserves space; one overflow menu is open at a time. Helper text appears only where it explains a consequential limitation or error. No slogans, repeated keyboard instructions, large blank image blocks or visible edit/delete button piles.

## Delivery and verification

The build emits versioned JS/CSS/fonts/image assets. Nginx serves HTML with revalidation and hashed assets with immutable caching to prevent mixed markup/style versions. Existing .html links resolve to the React app. No database schema/API contract changes are required by the UI migration. Verify actual production assets, phone/tablet/desktop, touch/keyboard dragging, all mutations, failure retention and reduced motion before acceptance. Physical iOS testing remains separate.
