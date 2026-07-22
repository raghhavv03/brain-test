# 🧠 Cognitive Brain Test

A responsive, high-precision Next.js web application (installable PWA) featuring five scientifically grounded cognitive assessment games. Users undergo an un-rigged cognitive evaluation, receive an honest "Brain Score" benchmark across multiple cognitive domains, and view personalized insights with interactive charts.

---

## 🌟 Key Features

* **5 Cognitive Assessment Games**: Measures core cognitive pillars—processing speed, working memory, visual attention, spatial recall, and reaction time.
* **Sub-Millisecond Precision Timing**: High-accuracy timing built using `performance.now()` bound to `requestAnimationFrame` loops rather than system clocks (`Date.now()`).
* **Honest Scoring Engine**: Scientifically normalized scoring algorithms calibrated against verified baseline performance metrics rather than arbitrary or gamified scores.
* **Interactive Results Dashboard**: Dynamic radar charts and percentile breakdowns powered by [Recharts](https://recharts.org/) and [Framer Motion](https://www.framer.com/motion/).
* **PWA Support**: Responsive, mobile-first design installable as a Progressive Web App.
* **Robust Backend & Persistence**: Powered by [Supabase](https://supabase.com/) Postgres DB with row-level security (RLS) and session integrity guardrails.
* **Comprehensive Testing Suite**: Unit testing via [Vitest](https://vitest.dev/) for scoring logic and automated end-to-end user journey validation with [Playwright](https://playwright.dev/).

---

## 🛠️ Tech Stack

* **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
* **Language**: [TypeScript](https://www.typescriptlang.org/)
* **UI & Styling**: [React 19](https://react.dev/), [Tailwind CSS v4](https://tailwindcss.com/), [shadcn/ui](https://ui.shadcn.com/)
* **Animations**: [Framer Motion](https://www.framer.com/motion/)
* **Charts & Data Viz**: [Recharts](https://recharts.org/)
* **Database & Auth**: [Supabase](https://supabase.com/) (PostgreSQL + RLS)
* **Testing**: [Vitest](https://vitest.dev/) (Unit) & [Playwright](https://playwright.dev/) (E2E)

---

## 🎮 Cognitive Assessment Suite

1. **Processing Speed**: Measures rapid stimulus identification and choice response execution.
2. **Working Memory**: Evaluates short-term spatial and sequential memory capacity.
3. **Visual Attention**: Tests target recognition against distracting visual stimuli.
4. **Spatial Reasoning**: Assesses pattern recognition and spatial manipulation skills.
5. **Reaction Time**: High-frequency measurement of motor response speed to visual cues.

---

## 🚀 Getting Started

### Prerequisites

* **Node.js**: `v20.x` or higher
* **npm**: `v10.x` or higher
* **Supabase Instance**: Free-tier or self-hosted Supabase project

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/cognitive-brain-test.git
   cd cognitive-brain-test
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env.local` file in the root directory (refer to `.env.local.example`):
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-instance.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

4. **Database Migrations**:
   Execute the migration scripts in `supabase/migrations/` sequentially in your Supabase SQL Editor:
   - `20260710_run_id_is_practice.sql`
   - `20260711_results_run_id_unique.sql`
   - `20260712_leads_session_id_unique.sql`
   - `20260714_trials_unique.sql`

5. **Start the Development Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📜 Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Launches local development server at `localhost:3000` |
| `npm run build` | Builds production bundle with Next.js static generation |
| `npm run start` | Starts production server build |
| `npm run typecheck` | Runs `tsc --noEmit` across all project files including tests |
| `npm run lint` | Evaluates project code style and syntax using ESLint |
| `npm test` | Runs unit tests for scoring engine and utilities with Vitest |
| `npm run test:e2e` | Runs Playwright E2E suite covering full user test flow |

---

## 🔬 Testing & Quality Assurance

* **Unit Testing (`npm test`)**: Verifies mathematical correctness, outlier handling, and normalization logic of the scoring engine via Vitest.
* **E2E Testing (`npm run test:e2e`)**: Simulates user interactions across all 5 games (practice and scored rounds) live against Supabase endpoints using Playwright.
* **Type Safety (`npm run typecheck`)**: Strict TypeScript configuration ensuring zero type errors across application routes and standalone test modules.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
