import * as vscode from 'vscode';

let autocompleteEnabled = true;
let statusBarItem: vscode.StatusBarItem;
let timeoutHandle: NodeJS.Timeout | undefined;

export function activate(context: vscode.ExtensionContext) {
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  updateStatusBar();
  statusBarItem.show();

  let disposable = vscode.commands.registerCommand('autocomplete-toggle.toggle', async () => {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
      timeoutHandle = undefined;
      autocompleteEnabled = true;
      updateAutocomplete(true);
      vscode.window.showInformationMessage('Autocomplete re-enabled manually.');
      updateStatusBar();
      return;
    }

    const options = [
      { label: '5 minutes', value: 5 * 60 * 1000 },
      { label: '15 minutes', value: 15 * 60 * 1000 },
      { label: '30 minutes', value: 30 * 60 * 1000 },
      { label: '1 hour', value: 60 * 60 * 1000 },
      { label: '3 hours', value: 3 * 60 * 60 * 1000 },
      { label: '5 hours', value: 5 * 60 * 60 * 1000 },
      { label: 'Custom (minutes)', value: -1 }
    ];

    const picked = await vscode.window.showQuickPick(options.map(o => o.label), { placeHolder: 'Select autocomplete off duration' });
    if (!picked) return;

    if (picked === 'Custom (minutes)') {
      const input = await vscode.window.showInputBox({ prompt: 'Enter minutes to disable autocomplete', validateInput: text => {
        const n = Number(text);
        if (isNaN(n) || n <= 0) return 'Please enter a positive number';
        return null;
      }});
      if (!input) return;

      const customMs = Number(input) * 60 * 1000;
      disableAutocompleteWithTimer(customMs);
    } else {
      const option = options.find(o => o.label === picked);
      if (option) {
        disableAutocompleteWithTimer(option.value);
      }
    }
  });

  context.subscriptions.push(disposable, statusBarItem);
}

function updateAutocomplete(enabled: boolean) {
  autocompleteEnabled = enabled;
  const config = vscode.workspace.getConfiguration('editor');
  const targets = [vscode.ConfigurationTarget.Global, vscode.ConfigurationTarget.Workspace];
  
  // Aplicar configuraciones en ambos niveles: global y workspace
  for (const target of targets) {
    // Desactivar quickSuggestions
    config.update('quickSuggestions', 
      enabled ? { other: true, comments: true, strings: true } : { other: false, comments: false, strings: false }, 
      target
    );
    
    // Desactivar sugerencias en caracteres trigger
    config.update('suggestOnTriggerCharacters', enabled, target);
    
    // Desactivar suggestions al escribir caracteres de commit
    config.update('acceptSuggestionOnCommitCharacter', enabled, target);
    
    // Desactivar hints de parámetros
    config.update('parameterHints.enabled', enabled, target);
    
    // Desactivar autocompletado inline
    config.update('inlineSuggest.enabled', enabled, target);
  }
  
  updateStatusBar();
}

function disableAutocompleteWithTimer(ms: number) {
  updateAutocomplete(false);
  vscode.window.showInformationMessage(`Autocomplete disabled for ${ms / 60000} minutes.`);

  if (timeoutHandle) {
    clearTimeout(timeoutHandle);
  }

  timeoutHandle = setTimeout(() => {
    updateAutocomplete(true);
    vscode.window.showInformationMessage('Autocomplete automatically re-enabled.');
    timeoutHandle = undefined;
  }, ms);
}

function updateStatusBar() {
  if (timeoutHandle) {
    statusBarItem.text = `$(watch) Autocomplete OFF`;
    statusBarItem.tooltip = 'Autocomplete is off. Click to cancel timer and re-enable.';
  } else {
    statusBarItem.text = autocompleteEnabled ? '$(clock) Autocomplete ON' : '$(clock) Autocomplete OFF';
    statusBarItem.tooltip = 'Click to disable autocomplete with timer';
  }
  statusBarItem.command = 'autocomplete-toggle.toggle';
}

export function deactivate() {
  if (timeoutHandle) {
    clearTimeout(timeoutHandle);
  }
  // Asegurarse de restaurar todas las configuraciones al desactivar la extensión
  updateAutocomplete(true);
}
