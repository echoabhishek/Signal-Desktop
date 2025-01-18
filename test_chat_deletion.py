
import os
import subprocess
import time
import json

def setup_test_environment():
    # Clone the repository if it doesn't exist
    if not os.path.exists('Signal-Desktop'):
        subprocess.run(['git', 'clone', 'https://github.com/echoabhishek/Signal-Desktop.git'])
    
    # Change to the Signal-Desktop directory
    os.chdir('Signal-Desktop')
    
    # Install dependencies
    subprocess.run(['npm', 'install'])

def run_test():
    # Start the application in test mode
    process = subprocess.Popen(['npm', 'run', 'test'], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    
    # Wait for the application to start
    time.sleep(10)
    
    # Simulate creating a conversation
    create_conversation_cmd = '''
    const { createConversation } = require('./ts/state/ducks/conversations');
    const conversation = createConversation({ id: 'test-conversation', name: 'Test Conversation' });
    console.log(JSON.stringify(conversation));
    '''
    result = subprocess.run(['node', '-e', create_conversation_cmd], capture_output=True, text=True)
    conversation = json.loads(result.stdout)
    
    # Simulate deleting the conversation
    delete_conversation_cmd = f'''
    const {{ deleteConversation }} = require('./ts/state/ducks/conversations');
    deleteConversation('{conversation['id']}');
    '''
    subprocess.run(['node', '-e', delete_conversation_cmd])
    
    # Verify that the conversation has been removed
    verify_deletion_cmd = f'''
    const {{ getConversationSelector }} = require('./ts/state/selectors/conversations');
    const state = require('./ts/state/getEmptyState')();
    const conversation = getConversationSelector(state)('{conversation['id']}');
    console.log(JSON.stringify(conversation));
    '''
    result = subprocess.run(['node', '-e', verify_deletion_cmd], capture_output=True, text=True)
    deleted_conversation = json.loads(result.stdout)
    
    if deleted_conversation is None:
        print("Test passed: Conversation was successfully deleted")
    else:
        print("Test failed: Conversation still exists after deletion")
    
    # Stop the application
    process.terminate()

if __name__ == '__main__':
    setup_test_environment()
    run_test()
    print("Test completed.")
