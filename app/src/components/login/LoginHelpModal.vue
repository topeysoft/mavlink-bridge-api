<template>
  <Modal
    :model-value="modelValue"
    :title="t('auth.login.help.modalTitle')"
    size="lg"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="help-body">
      <p class="intro">{{ t('auth.login.help.intro') }}</p>

      <section class="help-section">
        <h3 class="section-title">{{ t('auth.login.help.sectionTryFirst') }}</h3>

        <div class="option-card">
          <div class="option-icon">
            <component :is="getIcon('key')" :size="24" :stroke-width="2" />
          </div>
          <div class="option-content">
            <h4>{{ t('auth.login.help.useApiKey.title') }}</h4>
            <p>{{ t('auth.login.help.useApiKey.body') }}</p>
            <button type="button" class="option-action" @click="chooseApiKey">
              {{ t('auth.login.help.useApiKey.action') }}
            </button>
          </div>
        </div>

        <div class="option-card">
          <div class="option-icon">
            <component :is="getIcon('lock')" :size="24" :stroke-width="2" />
          </div>
          <div class="option-content">
            <h4>{{ t('auth.login.help.usePin.title') }}</h4>
            <p>{{ t('auth.login.help.usePin.body') }}</p>
            <button type="button" class="option-action option-action-secondary" @click="choosePin">
              {{ t('auth.login.help.usePin.action') }}
            </button>
          </div>
        </div>
      </section>

      <section class="help-section reset-section">
        <h3 class="section-title">
          <component :is="getIcon('alert-triangle')" :size="20" :stroke-width="2" class="section-warn-icon" />
          {{ t('auth.login.help.sectionReset') }}
        </h3>

        <div class="reset-warning">
          <strong>{{ t('auth.login.help.resetWarning') }}</strong>
        </div>

        <p class="reset-intro">{{ t('auth.login.help.resetIntro') }}</p>

        <details v-if="collapseSteps" class="reset-steps-wrapper">
          <summary class="reset-steps-summary">
            {{ t('auth.login.help.resetStepsTitle') }}
          </summary>
          <ResetSteps
            :step1="t('auth.login.help.resetStep1')"
            :step2="t('auth.login.help.resetStep2')"
            :step3="t('auth.login.help.resetStep3')"
            :step3-filename="t('auth.login.help.resetStep3Filename')"
            :step4="t('auth.login.help.resetStep4')"
            :copy-label="t('auth.login.help.copy')"
            :copied-label="t('auth.login.help.copied')"
          />
        </details>
        <ResetSteps
          v-else
          :step1="t('auth.login.help.resetStep1')"
          :step2="t('auth.login.help.resetStep2')"
          :step3="t('auth.login.help.resetStep3')"
          :step3-filename="t('auth.login.help.resetStep3Filename')"
          :step4="t('auth.login.help.resetStep4')"
          :copy-label="t('auth.login.help.copy')"
          :copied-label="t('auth.login.help.copied')"
        />

        <div v-if="isDeveloperMode" class="dev-shortcut">
          <h4>{{ t('auth.login.help.devShortcutTitle') }}</h4>
          <p>{{ t('auth.login.help.devShortcutBody') }}</p>
          <CopyBlock
            :value="t('auth.login.help.devShortcutCommand')"
            :copy-label="t('auth.login.help.copy')"
            :copied-label="t('auth.login.help.copied')"
          />
          <small class="dev-shortcut-caption">{{ t('auth.login.help.devShortcutCaption') }}</small>
        </div>
      </section>
    </div>

    <template #footer>
      <button type="button" class="btn-close" @click="close">
        {{ t('auth.login.help.close') }}
      </button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Modal from '@/components/common/Modal.vue'
import { getIcon } from '@/utils/iconMap'
import ResetSteps from './ResetSteps.vue'
import CopyBlock from './CopyBlock.vue'

interface Props {
  modelValue: boolean
  userMode: 'consumer' | 'power-user' | 'developer'
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'switch-method': [method: 'pin' | 'apikey']
}>()

const { t } = useI18n()

const collapseSteps = computed(() => props.userMode === 'consumer')
const isDeveloperMode = computed(() => props.userMode === 'developer')

function chooseApiKey() {
  emit('switch-method', 'apikey')
}

function choosePin() {
  emit('switch-method', 'pin')
}

function close() {
  emit('update:modelValue', false)
}
</script>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;

.help-body {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  color: $dark;
}

.intro {
  margin: 0;
  font-size: 0.95rem;
  color: $grey-7;
  line-height: 1.55;
}

.help-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: $dark;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.section-warn-icon {
  color: $warning;
}

.option-card {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid #e0e0e0;
  border-radius: 10px;
  background: #fafafa;
  transition: border-color 0.15s, background 0.15s;

  &:hover {
    border-color: rgba($primary, 0.4);
    background: rgba($primary, 0.03);
  }
}

.option-icon {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba($primary, 0.1);
  color: $primary;
  border-radius: 8px;
}

.option-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;

  h4 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: $dark;
  }

  p {
    margin: 0;
    font-size: 0.9rem;
    color: $grey-7;
    line-height: 1.5;
  }
}

.option-action {
  align-self: flex-start;
  margin-top: 0.25rem;
  padding: 0.5rem 1rem;
  background: $primary;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, transform 0.1s;

  &:hover {
    background: color-mix(in srgb, $primary 88%, black);
  }

  &:active {
    transform: translateY(1px);
  }
}

.option-action-secondary {
  background: white;
  color: $primary;
  border: 1.5px solid rgba($primary, 0.5);

  &:hover {
    background: rgba($primary, 0.08);
    border-color: $primary;
  }
}

.reset-section {
  padding: 1rem;
  border: 1px solid rgba($warning, 0.35);
  background: rgba($warning, 0.05);
  border-radius: 10px;
}

.reset-warning {
  padding: 0.75rem 1rem;
  background: white;
  border-left: 3px solid $warning;
  border-radius: 4px;
  font-size: 0.9rem;
  color: $dark;
  line-height: 1.5;
}

.reset-intro {
  margin: 0;
  font-size: 0.9rem;
  color: $grey-7;
  line-height: 1.55;
}

.reset-steps-wrapper {
  margin: 0;
}

.reset-steps-summary {
  cursor: pointer;
  font-weight: 600;
  color: $primary;
  padding: 0.5rem 0;
  font-size: 0.95rem;
  user-select: none;

  &:hover {
    color: color-mix(in srgb, $primary 80%, black);
  }
}

.dev-shortcut {
  margin-top: 1rem;
  padding: 0.85rem 1rem;
  background: white;
  border: 1px dashed rgba($dark, 0.15);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;

  h4 {
    margin: 0;
    font-size: 0.9rem;
    font-weight: 600;
    color: $dark;
  }

  p {
    margin: 0;
    font-size: 0.85rem;
    color: $grey-7;
    line-height: 1.5;
  }
}

.dev-shortcut-caption {
  font-size: 0.78rem;
  color: $grey-6;
  font-style: italic;
}

.btn-close {
  padding: 0.6rem 1.2rem;
  background: white;
  color: $dark;
  border: 1.5px solid #d0d0d0;
  border-radius: 6px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    background: #f5f5f5;
    border-color: #b0b0b0;
  }
}
</style>
