Using the information in `/Volumes/dev/yardrover-api/api-spec.yaml` and `/Volumes/dev/yardrover-api/client` as guide, create a comprehensive nature themed clean modern responsive web application for an autonomous multi-tasking, battery powered yard utility machine capable of mowing, snow clearing, leaf blowing, towing and patrolling. Use TypeScript, SCSS, Vue 3 Composition API (script setup), Pinia, Quasar 2 and other relevant libraries to build a user-friendly interface that allows users to easily control and monitor the machine's activities. It should be designed with a focus on usability and aesthetics, ensuring a seamless experience across devices. It should use electron and capacitor for building cross-platform desktop and mobile applications. To ensure continuity when building in stages across multiple AI coding sessions, create the prompts for each stage beforehand in the directory `/Volumes/dev/yardrover-api/frontend/prompts`.

Proposed file structure:

```
src/
├── components/
│   ├── MachineControl.vue
│   ├── MachineStatus.vue
│   └── UserSettings.vue
├── composables/
│   ├── useMachine.js
│   └── useUser.js
├── services/
│   ├── MachineService.js
│   └── UserService.js
├── store/
│   ├── machine.js
│   └── user.js
├── views/
│   ├── Dashboard.vue
│   └── Settings.vue
└── App.vue
```
