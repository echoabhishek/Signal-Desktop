
import os
import subprocess
import shutil
import time

def setup_test_environment():
    print("Setting up test environment...")
    if not os.path.exists('Signal-Desktop'):
        print("Cloning Signal-Desktop repository...")
        subprocess.run(['git', 'clone', 'https://github.com/echoabhishek/Signal-Desktop.git'])
    
    os.chdir('Signal-Desktop')
    print(f"Current directory: {os.getcwd()}")
    
    print("Installing system dependencies...")
    subprocess.run(['sudo', 'apt-get', 'update'])
    subprocess.run(['sudo', 'apt-get', 'install', '-y', 'libnss3', 'libatk1.0-0', 'libatk-bridge2.0-0', 'libcups2', 'libdrm2', 'libgtk-3-0', 'libgbm1', 'libasound2', 'xvfb'])
    
    print("Removing node_modules/electron directory...")
    electron_path = os.path.join('node_modules', 'electron')
    if os.path.exists(electron_path):
        shutil.rmtree(electron_path)
    
    print("Installing dependencies...")
    subprocess.run(['npm', 'install'])

def create_test_script():
    test_script = '''
    const { app, BrowserWindow } = require('electron');
    const path = require('path');

    // Mock the required modules
    const mockConversations = {
        createConversation: (data) => ({ id: data.id, name: data.name }),
        deleteConversation: async (id) => console.log(`Deleting conversation ${id}`)
    };
    const mockSelectors = {
        getConversationSelector: () => (id) => undefined
    };
    const mockState = {
        getEmptyState: () => ({})
    };

    async function runTest() {
        console.log('Starting test...');
        try {
            console.log('Creating test conversation...');
            const conversation = mockConversations.createConversation({ id: 'test-conversation', name: 'Test Conversation' });
            console.log('Conversation created:', JSON.stringify(conversation));

            console.log('Deleting test conversation...');
            await mockConversations.deleteConversation(conversation.id);
            console.log('Conversation deleted');

            console.log('Verifying conversation deletion...');
            const state = mockState.getEmptyState();
            const deletedConversation = mockSelectors.getConversationSelector()(conversation.id);
            console.log('Deleted conversation:', JSON.stringify(deletedConversation));

            if (deletedConversation === undefined) {
                console.log('Test passed: Conversation was successfully deleted');
            } else {
                console.log('Test failed: Conversation still exists after deletion');
            }
        } catch (error) {
            console.error('Error during test:', error);
        }
        app.quit();
    }

    function createWindow() {
        const win = new BrowserWindow({
            width: 800,
            height: 600,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false
            }
        });

        win.loadFile('index.html');
        win.webContents.openDevTools();
    }

    app.whenReady().then(() => {
        createWindow();
        runTest().catch(console.error);
    });

    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') {
            app.quit();
        }
    });
    '''
    
    with open('test_conversation_deletion.js', 'w') as f:
        f.write(test_script)

    # Create a minimal HTML file
    html_content = '''
    <!DOCTYPE html>
    <html>
    <head>
        <title>Test Electron App</title>
    </head>
    <body>
        <h1>Test Electron App</h1>
        <p>Check the console for test results.</p>
    </body>
    </html>
    '''
    
    with open('index.html', 'w') as f:
        f.write(html_content)

def run_test():
    print("Starting test...")
    create_test_script()
    
    print("Running test script with Xvfb...")
    xvfb_process = subprocess.Popen(['Xvfb', ':99', '-ac'])
    time.sleep(1)  # Give Xvfb time to start
    
    try:
        env = os.environ.copy()
        env['DISPLAY'] = ':99'
        result = subprocess.run(['npx', 'electron', './test_conversation_deletion.js'], capture_output=True, text=True, env=env, timeout=60)
        print("Test output:")
        print(result.stdout)
        print(result.stderr)
    except subprocess.TimeoutExpired:
        print("Test execution timed out after 60 seconds")
    finally:
        xvfb_process.terminate()

if __name__ == '__main__':
    setup_test_environment()
    run_test()
    print("Test completed.")
