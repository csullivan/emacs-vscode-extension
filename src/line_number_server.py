import os
from flask import Flask, jsonify
import subprocess

def get_emacs_position():
    lisp_command = '(let* ((current-window (frame-selected-window (selected-frame))) (current-buffer (window-buffer current-window)) (file-path (with-current-buffer current-buffer (buffer-file-name))) (line-number (with-current-buffer current-buffer (line-number-at-pos))) (column-number (with-current-buffer current-buffer (current-column)))) (list file-path line-number column-number))'
    result = subprocess.run(['emacsclient', '--eval', lisp_command], capture_output=True, text=True)

    # The output will be something like '("/path/to/file.txt" 3 7)'
    # We want to strip off the first and last characters and then split the string into parts
    result = result.stdout[2:-2].split()

    # Now we convert the results to the correct types and return them
    file_path = result[0][1:-1] # Remove the quotes around the file name
    line = int(result[1])
    column = int(result[2])
    return file_path, line, column


app = Flask(__name__)

# @app.route('/position', methods=['GET'])
# def get_position():
#     # You would replace this with your actual logic for getting the line, column and file path
#     file_path = "test_file.py"
#     file_path = os.path.realpath(file_path)
    
#     line = 3
#     column = 7
#     return jsonify({'line': line, 'column': column, 'file_path': file_path})

@app.route('/position', methods=['GET'])
def get_position():
    file_path, line, column = get_emacs_position()
    return jsonify({'line': line, 'column': column, 'file_path': file_path})

if __name__ == '__main__':
    app.run(port=5000)
