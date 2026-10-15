Create an exact, production-usable replica of my existing franchise management web app. Do not simplify, redesign, or skip files. Recreate behavior, routes, validation logic, auth flow, role-based access, and UI interactions exactly as specified below.

## Project Type

- Next.js 16.2.4, App Router, TypeScript
- React 19.2.4
- Tailwind CSS v4
- MongoDB with Mongoose
- JWT/cookie auth
- Jest tests for lib utilities

## Dependencies and Versions

- next 16.2.4
- react 19.2.4
- react-dom 19.2.4
- mongoose 8.23.0
- bcryptjs 3.0.3
- jose 6.2.2
- jsonwebtoken 9.0.3
- swagger-ui-react 5.32.4
- openapi-types 12.1.3
- TypeScript 5
- eslint 9
- eslint-config-next 16.2.4
- jest 30.3.0
- ts-jest 29.4.9
- dotenv 17.4.2
- tsx 4.21.0

## Core Requirements

### Authentication and Session

- Login/logout API using cookie-based sessions.
- Middleware route protection.
- Session cookie name: em_session.
- Role system:
  - admin (Super Admin)
  - sub_admin
  - franchise_admin
  - employee

### Data Models

- User model fields:
  - email, password hash, name, role, franchises
  - optional profile fields such as phone, dob, and banking/KYC-like fields
- Franchise model fields:
  - name, storeCode (unique, uppercase), description, address, phone, storeType, isActive
- Mongoose connection with a globally cached connection object.

### App Structure

- Public pages:
  - login
  - docs (Swagger UI page)
- Protected app shell:
  - dashboard
  - attendance
  - employees
  - profile
  - sales
  - stores
  - users
- API routes:
  - auth/login
  - auth/logout
  - me (get + patch profile/password)
  - stores (list)
  - stores/active
  - stores/select
  - users (CRUD via users and users/[id])
  - dashboard
  - docs spec endpoint

### Store Selection Flow

- For non-admin/sub_admin users, enforce active store selection.
- If only one store exists, auto-select it.
- If multiple stores exist, show a store selector modal.
- Sidebar shows active store and a switch-store action.
- Store selector modal supports loading, active state, and selection feedback.

### Profile Page Behavior (Must Match Exactly)

- Two sections: update name and change password.
- Custom validation only (no browser-required validation popups).
- On validation error: show field-level error, red border, and red background for invalid fields.
- Toast notifications shown at top-right.
- Password change validations:
  - current password required
  - new password required
  - confirm password required
  - confirm must match new
  - minimum 8 characters
  - at least 1 uppercase letter
  - at least 1 number
  - at least 1 special character
  - new password cannot equal current password
- On validation error: do not clear password fields.
- On success: clear all 3 password fields.
- Password visibility toggle with eye and eye-slash icons.

### Icon Architecture (Must Match)

- Central icons folder with reusable icon components.
- Single barrel export file index.ts in icons folder.
- All pages/components import icons only from that single index file.
- No inline SVG usage outside icon component files.

### Toast System

- Reusable Toast component and toast hook.
- Types: success, error, info.
- Auto-dismiss and manual close.
- Toast container fixed at top-right.

### Seed Script Behavior

- Script clears all existing users and franchises.
- Inserts only one super admin user.
- Requires MONGODB_URI and SEED_ADMIN_PASSWORD.
- Refuses to run in production.
- Hashes password with bcrypt.

### Users and Stores Management UI

- Users page:
  - add/edit/delete modals
  - franchise filtering
  - role badges
  - responsive table/cards
- Stores page:
  - create store form
  - list cards with status/type badges and metadata

### API Docs

- OpenAPI spec object generation.
- Swagger UI page to render docs.

### Tests

- Add test coverage for key lib utilities:
  - auth
  - cookie options
  - crypto
  - rate limit
  - server env

## Deliverables

- Full source code with complete folder/file structure.
- No placeholders or TODO stubs.
- All imports correct.
- Build and lint runnable.
- Include scripts in package configuration:
  - dev
  - build
  - start
  - lint
  - test
  - test:watch

## Acceptance Criteria

- App runs end-to-end with npm install and npm run dev.
- Login, role-based access, store selection, profile password flow, toast behavior, and CRUD flows all work.
- Icon usage is centralized via icons index barrel only.
- Seed script produces exactly one super admin user after data wipe.
- Now generate the full project code.

Also, yes, I have appended your latest prompt to your prompt history file.

## 2026-05-06

1. Clear all data in the DB and keep only a super admin user.
2. Give me the command to run seed.ts.
3. On the change password screen, error/success is displayed at the bottom. Create a toast component and use that.
4. Display the toast at the top-right corner.
5. On both error and success, clear all 3 fields.
6. Follow the password criteria below:
   - New password cannot be the same as old password.
   - New password should contain a minimum of 8 characters.
   - At least 1 uppercase letter, at least 1 special character, and at least 1 number.
7. We are currently using browser default validation. Please use custom validation. If there are errors, highlight the field with a red border.
8. In case of error, change the background color of the field as well.
9. Do not clear password fields on error.
10. Give an eye icon to show the password on click and hide it on click again.
11. Toggle between eye and eye-slash icons.
12. The password hide icon is not correct. Also, we are using SVGs directly for icons. Create an icons folder and reuse icons. Do not recreate icons every time.
13. For icons, create an index file and export from there. Then import from one single file.
14. Even now the password hide icon is not correct.
15. Change all icons in the application to use the icons folder and the index file.
16. Remove all unwanted files and unused imports from the code.
17. Create a file and add all prompts I have given to date. Also ensure that in the future we keep adding to the same file.
18. What about all prompts I gave over the last couple of weeks?
19. Give me a proper prompt that can generate an exact replica of our application as built to date. If I use the prompt and generate code, I should be able to do everything exactly.
20. Follow the same error convention, toast message format, and icon usage throughout the application.

## 2026-05-07

21. Remove all unit test-related setup from the project. We will add it later. Delete packages and remove them from package.json as well.
22. Add a timer to log out the user. After 4 minutes, show a popup asking whether the user wants to extend the session. If user clicks continue, extend session; otherwise destroy session and log the user out. On next login, redirect user to the previous screen.
23. I see the session timeout modal code is in AppShell.tsx. Move that code to a separate file in the components folder and use it.
24. The session prompt should stay for 1 minute. Show a timer in the popup. After that, destroy session and log user out. Also, no toast when session is extended, and no button label change to "extending"; just show a loading symbol on click.
25. On any screen, if user has made changes and tries to navigate away, ask for confirmation that unsaved changes will be lost.
26. We are currently using browser alert. Use a custom modal. Also, the code is in AppShell again; can we move the logic to a new component and use it in AppShell?
27. The unsaved changes popup appears even after closing popup. Once popup is closed, clear changes.
28. Still not working. In Add User, I entered a name, clicked close, then clicked dashboard; unsaved changes popup still appears. Ideally it should not.
29. In Add User popup input fields, input text color should be black.
30. Check whether application is build-ready. Run npm run build and check for errors.
31. Yes.
32. If Add User popup is open and left idle, after 4 minutes session popup appears under Add User popup. Also, if user is inactive for 1 minute after session timeout popup appears, user should be logged out automatically. Currently nothing happens.
33. Once auto logout happens, redirect to login screen. In login screen, show message that user was logged out due to inactivity.
34. Build error occurred: Both middleware file "./middleware.ts" and proxy file "./proxy.ts" are detected. Please use "./proxy.ts" only.
35. In all input fields, color should be black.
36. A sub admin cannot see super admin and cannot change super admin data.
37. Add same condition in API as well. Even if I know the API and super admin ID (via Postman or other tools), I should not be able to change super admin values.
38. Check all security concerns once. See if there is any problem in the code.
39. Go through prompts history file and make sure all spelling is checked and sentences are properly formatted.
40. Any user can see only the users they have created. Super admin can see all users.
41. If I manually log out, no need to remember previous route. Only auto logout should remember previous URL and redirect user back to same route after re-login.
42. One user cannot see another user and can only see users created by them, but dashboard count is still showing everything.
43. Apply same rule for stores as well: a user can see stores they created or are assigned to. On login, if no stores are associated with user, log out and show error message.
44. Super admin can create sub admins without being associated with stores. Sub admin can login without store association. Sub admin can only create users for franchises (franchise_admin and employee roles only).
45. When sub admin creates a user, do not show role field - default to store admin. If sub admin has no stores, cannot create users. Store admin users must be assigned to at least one store.
46. Give the admin who created a store an option to delete it. Do not show the delete button when the store was created by another admin.
47. Give the admin who created a store an option to edit its details.
48. Add an edit icon to the store edit option.
49. Make the edit icon blue.
50. Make the edit icon and Edit text use the site's primary blue color.
51. Change the cursor to a pointer on the Edit and Delete actions.
52. Update the store URL with the store ID while editing and restore the edit screen after refresh.
53. Hide the store cards while editing and display only the edit form.
54. Add a franchise owner details card to the add and edit store forms for franchise stores.
