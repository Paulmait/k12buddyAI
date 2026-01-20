# K-12Buddy AI - Project Context for Claude

## Project Overview
K-12Buddy AI is an educational mobile app for K-12 students featuring AI-powered tutoring, homework help via photo scanning, and adaptive learning. Built with React Native (Expo) and Supabase backend.

## Tech Stack
- **Frontend**: React Native with Expo SDK 53
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **Navigation**: Expo Router (file-based routing)
- **State Storage**: AsyncStorage (consent), SecureStore (auth tokens)
- **Build**: EAS Build for iOS/Android

## Project Structure
```
k12buddylearning/
├── apps/
│   └── mobile/                 # React Native Expo app
│       ├── app/                # Expo Router screens
│       │   ├── (tabs)/         # Main tab navigation
│       │   │   ├── index.tsx   # Home screen
│       │   │   ├── chat.tsx    # AI chat screen
│       │   │   ├── scan.tsx    # Homework scanner
│       │   │   └── profile.tsx # User profile
│       │   ├── settings/       # Settings screens
│       │   │   ├── account.tsx
│       │   │   ├── devices.tsx
│       │   │   └── privacy.tsx
│       │   ├── profile/
│       │   │   └── edit.tsx
│       │   ├── _layout.tsx     # Root layout with auth/consent logic
│       │   ├── auth.tsx        # Login/Signup screen
│       │   ├── consent.tsx     # AI consent gate (required first)
│       │   └── onboarding/     # Onboarding flow
│       ├── src/
│       │   └── lib/
│       │       └── supabase.ts # Supabase client config
│       ├── app.json            # Expo config
│       ├── eas.json            # EAS Build config
│       └── package.json
├── supabase/
│   └── migrations/             # Database migrations
└── docs/                       # Privacy policy, terms HTML
```

## Key Files

### Authentication Flow
1. `app/_layout.tsx` - Checks consent first, then routes to auth or main app
2. `app/consent.tsx` - AI Learning Acknowledgment (shown once, stored in AsyncStorage)
3. `app/auth.tsx` - Supabase authentication (signup/signin)
4. `app/onboarding/` - Profile setup after signup

### Consent Logic
- Version: `1.0` - Stored in `k12buddy_ai_consent` AsyncStorage key
- Must acknowledge before accessing any other screen
- Includes toggle for allowing child AI features

### Supabase Config
- URL: `https://mojzcrgbervqsscixknu.supabase.co`
- Uses SecureStore adapter for token persistence
- Env vars: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`

## Build Commands

### iOS Preview Build (Internal Testing)
```bash
cd apps/mobile
npx eas build --platform ios --profile preview --non-interactive
```

### iOS Production Build
```bash
cd apps/mobile
npx eas build --platform ios --profile production --non-interactive
```

### Local Development
```bash
cd apps/mobile
npx expo start
```

## EAS Build Profiles
- `development`: Local dev builds
- `preview`: Internal testing (Ad Hoc distribution)
- `production`: App Store submission

## Current State (January 2026)

### Completed Features
- Consent gate with AI acknowledgment
- Supabase authentication (signup/signin)
- Tab navigation (Home, Chat, Scan, Profile)
- Settings screens (Account, Devices, Privacy)
- Profile editing
- Privacy Policy and Terms of Service pages

### Latest Build
- Build ID: `e80aee71-814a-4236-803d-72f0b14b3ef7`
- Install URL: https://expo.dev/accounts/guampaul/projects/k-12buddy-ai/builds/e80aee71-814a-4236-803d-72f0b14b3ef7
- Features: Consent gate, Supabase auth, Password generation option

### Pending Features (from implementation plan)
- Device registration system
- Parent onboarding flow
- Account deletion (1-click cancel)
- Responsive design for tablets
- Data export functionality

## Database Tables
- `profiles` - User profiles with grade level, subjects, etc.
- `students` - Student records linked to users
- `chat_sessions` - AI chat history
- `chat_messages` - Individual messages
- `student_uploads` - Scanned homework images
- `user_devices` - Device registration (planned)

## Color Scheme
- Primary: `#4F46E5` (Indigo)
- Background: `#F9FAFB` (Light gray)
- Text: `#1F2937` (Dark gray)
- Accent: `#C7D2FE` (Light indigo)

## Important Notes
- COPPA compliance required for users under 13
- All screens use SafeAreaView for notch handling
- Consent must be checked before any navigation
- Email confirmation may be required depending on Supabase settings
