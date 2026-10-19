/**
 * Food Webapp — Responsive Layout Tests
 * Browser console tests for mobile and desktop layouts.
 * Run these manually in browser DevTools console at various viewport sizes.
 */

// Test configuration
const testSizes = {
    phone: 375,
    tablet: 768,
    desktop: 1440
};

// Escape HTML for safe display
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Test recipe grid responsiveness
function testRecipeGrid() {
    console.log('%c📱 Recipe Grid Responsive Test', 'color: blue; font-weight: bold; font-size: 16px');
    
    const grid = document.getElementById('recipe-grid');
    if (!grid) {
        console.warn('❗ Recipe grid element not found. Check if index.html loaded properly.');
        return false;
    }

    // Get current computed styles
    const computed = getComputedStyle(grid);
    const gridTemplateColumns = computed.gridTemplateColumns;
    const gap = computed.gap;
    const padding = computed.padding;

    console.log(`Current viewport: ${window.innerWidth}x${window.innerHeight}px`);
    console.log(`Grid columns: ${gridTemplateColumns}`);
    console.log(`Gap: ${gap}`);
    console.log(`Padding: ${padding}`);

    // Validate breakpoints
    let passed = true;
    
    if (window.innerWidth < 600) {
        if (!gridTemplateColumns.includes('2')) {
            console.error('❌ FAIL: Mobile (<600px) should have 2 columns, got:', gridTemplateColumns);
            passed = false;
        } else {
            console.log('✅ PASS: Mobile layout (2 cols)');
        }
    } else if (window.innerWidth >= 600 && window.innerWidth < 900) {
        if (!gridTemplateColumns.includes('3')) {
            console.error('❌ FAIL: Tablet (600-899px) should have 3 columns, got:', gridTemplateColumns);
            passed = false;
        } else {
            console.log('✅ PASS: Tablet layout (3 cols)');
        }
    } else if (window.innerWidth >= 900) {
        if (!gridTemplateColumns.includes('4')) {
            console.error('❌ FAIL: Desktop (≥900px) should have 4 columns, got:', gridTemplateColumns);
            passed = false;
        } else {
            console.log('✅ PASS: Desktop layout (4 cols)');
        }
    }

    return passed;
}

// Test gallery grid responsiveness
function testGalleryGrid() {
    console.log('%c🖼️ Gallery Grid Responsive Test', 'color: green; font-weight: bold; font-size: 16px');
    
    const grid = document.getElementById('gallery-grid');
    if (!grid) {
        console.warn('❗ Gallery grid element not found. Check if photos.html loaded properly.');
        return false;
    }

    const computed = getComputedStyle(grid);
    const gridTemplateColumns = computed.gridTemplateColumns;
    
    console.log(`Current viewport: ${window.innerWidth}x${window.innerHeight}px`);
    console.log(`Grid columns: ${gridTemplateColumns}`);

    let passed = true;
    
    if (window.innerWidth < 600) {
        if (!gridTemplateColumns.includes('2')) {
            console.error('❌ FAIL: Mobile (<600px) should have 2 columns, got:', gridTemplateColumns);
            passed = false;
        } else {
            console.log('✅ PASS: Mobile layout (2 cols)');
        }
    } else if (window.innerWidth >= 600 && window.innerWidth < 900) {
        if (!gridTemplateColumns.includes('3')) {
            console.error('❌ FAIL: Tablet (600-899px) should have 3 columns, got:', gridTemplateColumns);
            passed = false;
        } else {
            console.log('✅ PASS: Tablet layout (3 cols)');
        }
    } else if (window.innerWidth >= 900) {
        if (!gridTemplateColumns.includes('4')) {
            console.error('❌ FAIL: Desktop (≥900px) should have 4 columns, got:', gridTemplateColumns);
            passed = false;
        } else {
            console.log('✅ PASS: Desktop layout (4 cols)');
        }
    }

    return passed;
}

// Test cooking mode overlay
function testCookingMode() {
    console.log('%c🍳 Cooking Mode Layout Test', 'color: orange; font-weight: bold; font-size: 16px');
    
    const overlay = document.getElementById('cooking-mode');
    if (!overlay) {
        console.warn('❗ Cooking mode element not found.');
        return false;
    }

    const computed = getComputedStyle(overlay);
    const position = computed.position;
    const width = computed.width;
    const height = computed.height;
    
    console.log(`Position: ${position}`);
    console.log(`Width: ${width}`);
    console.log(`Height: ${height}`);

    if (position === 'fixed' && width === '100%' && height === '100%') {
        console.log('✅ PASS: Cooking mode is full-screen fixed overlay');
        return true;
    } else {
        console.error('❌ FAIL: Cooking mode should be fixed, 100%, 100%');
        return false;
    }
}

// Test modal layout
function testModalLayout() {
    console.log('%c📋 Modal Layout Test', 'color: purple; font-weight: bold; font-size: 16px');
    
    const modals = ['recipe-modal', 'list-modal', 'photo-modal'];
    let allPassed = true;

    modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (modal) {
            const computed = getComputedStyle(modal);
            const position = computed.position;
            const zindex = computed.zIndex;
            
            if (position === 'fixed' && parseInt(zindex) > 100) {
                console.log(`✅ PASS: ${modalId} is fixed modal with z-index ${zindex}`);
            } else {
                console.error(`❌ FAIL: ${modalId} should be fixed with z-index > 100`);
                allPassed = false;
            }
        }
    });

    return allPassed;
}

// Test accessibility attributes
function testAccessibility() {
    console.log('%c♿ Accessibility Test', 'color: teal; font-weight: bold; font-size: 16px');
    
    let passed = true;
    
    // Check semantic HTML usage
    const mainElement = document.querySelector('main');
    if (!mainElement) {
        console.warn('⚠️ Warning: <main> element not found');
    } else {
        const ariaLabel = mainElement.getAttribute('aria-label');
        if (ariaLabel) {
            console.log(`✅ PASS: Main element has aria-label: "${escapeHtml(ariaLabel)}"`);
        } else {
            console.warn('⚠️ Warning: <main> should have aria-label for screen readers');
        }
    }

    // Check button focus states in CSS
    const styles = document.styleSheets;
    let focusStylesFound = false;
    
    try {
        for (const sheet of styles) {
            try {
                const rules = sheet.cssRules || sheet.rules;
                for (const rule of rules) {
                    if (rule.selectorText === '.btn:focus' || 
                        rule.selectorText === 'button:focus') {
                        focusStylesFound = true;
                        break;
                    }
                }
            } catch (e) {
                // Cross-origin stylesheet
            }
        }
    } catch (e) {
        console.warn('⚠️ Could not parse stylesheets:', e.message);
    }

    if (focusStylesFound) {
        console.log('✅ PASS: Focus styles found for interactive elements');
    } else {
        console.warn('⚠️ Warning: No focus styles detected in stylesheets');
    }

    return passed;
}

// Run all tests
function runAllTests() {
    console.log('%c═══════════════════════════════════════════', 'color: black; font-weight: bold; font-size: 14px');
    console.log('%c🧪 Food Webapp Responsive Tests', 'color: black; font-weight: bold; font-size: 20px');
    console.log('%c═══════════════════════════════════════════', 'color: black; font-weight: bold; font-size: 14px');
    console.log(`Viewport: ${window.innerWidth}x${window.innerHeight}px`);
    
    const results = {
        recipeGrid: testRecipeGrid(),
        galleryGrid: testGalleryGrid(),
        cookingMode: testCookingMode(),
        modalLayout: testModalLayout(),
        accessibility: testAccessibility()
    };

    console.log('%c═══════════════════════════════════════════', 'color: black; font-weight: bold; font-size: 14px');
    console.log('%c📊 Test Results:', 'color: black; font-weight: bold; font-size: 16px');
    
    Object.entries(results).forEach(([test, passed]) => {
        console.log(`  ${passed ? '✅ PASS' : '❌ FAIL'}: ${test.replace(/([A-Z])/g, ' $1').trim()}`);
    });

    const totalPassed = Object.values(results).filter(Boolean).length;
    const totalTests = Object.keys(results).length;
    
    console.log(`\nTotal: ${totalPassed}/${totalTests} tests passed`);
    console.log('%c═══════════════════════════════════════════', 'color: black; font-weight: bold; font-size: 14px');
    
    return totalPassed === totalTests;
}

// Auto-run tests
runAllTests();

// Instructions for manual testing
console.log('%c📋 Testing Instructions:', 'color: blue; font-weight: bold');
console.log('   1. Open browser DevTools (F12)');
console.log('   2. Go to Network tab, reload page to capture assets');
console.log('   3. Go to Elements/Inspector tab to verify DOM structure');
console.log('   4. Use Responsiveness mode (Ctrl+Shift+M) to test at different sizes:');
console.log('      - iPhone SE: 375x667');
console.log('      - iPhone 12: 390x844');
console.log('      - iPad: 768x1024');
console.log('      - Desktop: 1440x900');
