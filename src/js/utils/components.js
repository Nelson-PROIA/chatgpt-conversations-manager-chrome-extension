// ============================================================================
// Component Loader Utility
// ============================================================================

import { COMPONENT_PATHS, COMPONENT_TARGETS } from '../../modal/components/index.js';

export class ComponentLoader {
  /**
   * Loads a single component from a path into a target element
   * @param {string} componentPath - Path to the component HTML file
   * @param {string} targetElementId - ID of the target element
   * @returns {Promise<boolean>} Success status
   */
  static async loadComponent(componentPath, targetElementId) {
    try {
      console.log(`Loading component: ${componentPath} into ${targetElementId}`);
      const response = await fetch(componentPath);
      if (!response.ok) {
        throw new Error(`Failed to load component: ${response.statusText}`);
      }
      
      const html = await response.text();
      console.log(`Component HTML loaded:`, html.substring(0, 100) + '...');
      
      const targetElement = document.getElementById(targetElementId);
      
      if (targetElement) {
        targetElement.innerHTML = html;
        console.log(`Component loaded successfully into ${targetElementId}`);
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

  /**
   * Loads multiple components from a configuration array
   * @param {Array<{path: string, target: string}>} components - Array of component configurations
   * @returns {Promise<boolean>} Success status
   */
  static async loadComponents(components) {
    const loadPromises = components.map(comp => 
      this.loadComponent(comp.path, comp.target)
    );

    try {
      await Promise.all(loadPromises);
      console.log(`All ${components.length} components loaded successfully`);
      return true;
    } catch (error) {
      console.error('Error loading components:', error);
      return false;
    }
  }

  /**
   * Loads all modal components (legacy method for backward compatibility)
   * @returns {Promise<boolean>} Success status
   */
  static async loadAllComponents() {
    const components = [
      { path: COMPONENT_PATHS.HEADER, target: COMPONENT_TARGETS.HEADER },
      { path: COMPONENT_PATHS.FOOTER, target: COMPONENT_TARGETS.FOOTER },
      { path: COMPONENT_PATHS.SEARCH, target: COMPONENT_TARGETS.SEARCH },
      { path: COMPONENT_PATHS.ACTIONS, target: COMPONENT_TARGETS.ACTIONS },
      { path: COMPONENT_PATHS.CONVERSATIONS, target: COMPONENT_TARGETS.CONVERSATIONS },
      { path: COMPONENT_PATHS.CONFIRMATION_MODAL, target: COMPONENT_TARGETS.CONFIRMATION_MODAL },
      { path: COMPONENT_PATHS.TOAST, target: COMPONENT_TARGETS.TOAST }
    ];

    return this.loadComponents(components);
  }
}
