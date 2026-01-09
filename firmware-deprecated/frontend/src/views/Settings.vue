<template>
  <q-page class="settings-page">
    <div class="q-pa-md">
      <q-card class="nature-card">
        <q-card-section class="bg-storm-gray text-white">
          <h4 class="q-ma-none">
            <q-icon name="settings" class="q-mr-sm" />
            Settings
          </h4>
        </q-card-section>

        <q-card-section>
          <p class="text-body1">Configure your YardRover preferences and system settings.</p>

          <q-list>
            <q-expansion-item
              expand-separator
              icon="account_circle"
              label="User Profile"
              caption="Manage your account settings"
            >
              <q-card>
                <q-card-section> User profile settings will be implemented here. </q-card-section>
              </q-card>
            </q-expansion-item>

            <q-expansion-item
              expand-separator
              icon="build"
              label="Machine Settings"
              caption="Configure machine preferences"
            >
              <q-card>
                <q-card-section>
                  Machine configuration options will be available here.
                </q-card-section>
              </q-card>
            </q-expansion-item>

            <q-expansion-item
              expand-separator
              icon="notifications"
              label="Notifications"
              caption="Set up alerts and notifications"
            >
              <q-card>
                <q-card-section> Notification preferences will be configured here. </q-card-section>
              </q-card>
            </q-expansion-item>
          </q-list>
        </q-card-section>
      </q-card>
    </div>
  </q-page>
</template>

<script setup lang="ts">
// Settings logic will be implemented in later stages
</script>

<style scoped lang="scss">
.settings-page {
  .bg-storm-gray {
    background: linear-gradient(135deg, #607d8b, #455a64);
  }
}
</style>
