# Project architecture rules

- Pin the TanStack Start, React Router, router-core, and router-plugin dependencies to exact mutually compatible versions and synchronize both Bun and npm lockfiles after dependency changes; Vercel installs with npm and newer Start releases can require a different Vite major.