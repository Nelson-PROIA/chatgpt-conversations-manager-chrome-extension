// ============================================================================
// Component Loader Utility
// ============================================================================

import { COMPONENT_PATHS, COMPONENT_TARGETS } from '../../components/index.js';

export class ComponentLoader {
  static async loadComponent(componentPath, targetElementId) {
    try {
      const response = await fetch(componentPath);
      if (!response.ok) {
        throw new Error(`Failed to load component: ${response.statusText}`);
      }
      
      const html = await response.text();
      const targetElement = document.getElementById(targetElementId);
      
      if (targetElement) {
        targetElement.innerHTML = html;
        return true;
      } else {
        console.error(`Target element not found: ${targetElementId}`);
        return false;
      }
    } catch (error) {
      console.error('Error loading component:', error);
      return false;
    }
  }

  static async loadAllComponents() {
    const components = [
      { path: COMPONENT_PATHS.HEADER, target: COMPONENT_TARGETS.HEADER },
      { path: COMPONENT_PATHS.FOOTER, target: COMPONENT_TARGETS.FOOTER },
      { path: COMPONENT_PATHS.GENERAL_TAB, target: COMPONENT_TARGETS.GENERAL_TAB },
      { path: COMPONENT_PATHS.CHATGPT_TAB, target: COMPONENT_TARGETS.CHATGPT_TAB },
      { path: COMPONENT_PATHS.CHATGPT_SKELETON, target: COMPONENT_TARGETS.CHATGPT_SKELETON },
      { path: COMPONENT_PATHS.SETTINGS_PAGE, target: COMPONENT_TARGETS.SETTINGS_PAGE },
      { path: COMPONENT_PATHS.CONFIRMATION_MODAL, target: COMPONENT_TARGETS.CONFIRMATION_MODAL },
      { path: COMPONENT_PATHS.TOAST, target: COMPONENT_TARGETS.TOAST }
    ];

    const loadPromises = components.map(comp => 
      this.loadComponent(comp.path, comp.target)
    );

    try {
      await Promise.all(loadPromises);
      console.log('All components loaded successfully');
      return true;
    } catch (error) {
      console.error('Error loading components:', error);
      return false;
    }
  }

  static showComponent(componentId) {
    const components = [
      'general-tab-component',
      'chatgpt-tab-component', 
      'chatgpt-skeleton-component',
      'settings-page-component'
    ];

    components.forEach(id => {
      const element = document.getElementById(id);

      if (element) {
        element.style.display = id === componentId ? 'block' : 'none';
      }
    });
  }

  static hideAllComponents() {
    const components = [
      'general-tab-component',
      'chatgpt-tab-component',
      'chatgpt-skeleton-component', 
      'settings-page-component'
    ];

    components.forEach(id => {
      const element = document.getElementById(id);
      
      if (element) {
        element.style.display = 'none';
      }
    });
  }
}
