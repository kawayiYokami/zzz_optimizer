<template>
  <div class="h-full overflow-y-auto p-4 lg:p-8  bg-base-200">
    <div class="max-w-6xl mx-auto">
      <!-- Team List -->
      <TeamList @select="openEditModal" @create="openCreateModal" />

      <!-- Edit Modal -->
      <TeamEditModal
        :show="showModal"
        :team-id="editingTeamId"
        @saved="handleSaved"
        @deleted="handleDeleted"
        @cancel="closeModal"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import TeamList from '../components/business/TeamList.vue';
import TeamEditModal from '../components/business/TeamEditModal.vue';

const showModal = ref(false);
const editingTeamId = ref<string | undefined>(undefined);

function openCreateModal() {
  editingTeamId.value = undefined;
  showModal.value = true;
}

function openEditModal(teamId: string) {
  editingTeamId.value = teamId;
  showModal.value = true;
}

function closeModal() {
  showModal.value = false;
  editingTeamId.value = undefined;
}

function handleSaved() {
  closeModal();
}

function handleDeleted() {
  closeModal();
}
</script>