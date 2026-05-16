import { onMounted, onUnmounted, readonly, ref, type Ref } from "vue";

const isAltPressed = ref(false);
let refCount = 0;
let attached = false;

const handleKeydown = (event: KeyboardEvent) => {
  if (event.altKey) isAltPressed.value = true;
};

const handleKeyup = (event: KeyboardEvent) => {
  if (!event.altKey) isAltPressed.value = false;
};

const handleBlur = () => {
  isAltPressed.value = false;
};

const handleVisibility = () => {
  if (document.hidden) isAltPressed.value = false;
};

const attach = () => {
  if (attached) return;
  window.addEventListener("keydown", handleKeydown, { capture: true });
  window.addEventListener("keyup", handleKeyup, { capture: true });
  window.addEventListener("blur", handleBlur);
  document.addEventListener("visibilitychange", handleVisibility);
  attached = true;
};

const detach = () => {
  if (!attached) return;
  window.removeEventListener("keydown", handleKeydown, { capture: true });
  window.removeEventListener("keyup", handleKeyup, { capture: true });
  window.removeEventListener("blur", handleBlur);
  document.removeEventListener("visibilitychange", handleVisibility);
  attached = false;
};

export const useAltKey = (): { isAltPressed: Readonly<Ref<boolean>> } => {
  onMounted(() => {
    refCount++;
    if (refCount === 1) attach();
  });
  onUnmounted(() => {
    refCount--;
    if (refCount === 0) {
      detach();
      isAltPressed.value = false;
    }
  });
  return { isAltPressed: readonly(isAltPressed) };
};
