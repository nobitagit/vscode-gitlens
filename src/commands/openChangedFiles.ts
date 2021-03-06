'use strict';
import { TextEditor, Uri, window } from 'vscode';
import { ActiveEditorCommand, Commands, openEditor } from './commands';
import { GitProvider } from '../gitProvider';
import { Logger } from '../logger';
import * as path from 'path';

export class OpenChangedFilesCommand extends ActiveEditorCommand {

    constructor(private git: GitProvider, private repoPath: string) {
        super(Commands.OpenChangedFiles);
    }

    async execute(editor: TextEditor, uri?: Uri, uris?: Uri[]) {
        if (!(uri instanceof Uri)) {
            uri = editor && editor.document && editor.document.uri;
        }

        try {
            if (!uris) {
                const repoPath = await this.git.getRepoPathFromUri(uri, this.repoPath);
                if (!repoPath) return window.showWarningMessage(`Unable to open changed files`);

                const statuses = await this.git.getStatusesForRepo(repoPath);
                if (!statuses) return window.showWarningMessage(`Unable to open changed files`);

                uris = statuses.filter(_ => _.status !== 'D').map(_ => Uri.file(path.resolve(repoPath, _.fileName)));
            }

            for (const uri of uris) {
                await openEditor(uri, true);
            }

            return undefined;
        }
        catch (ex) {
            Logger.error('[GitLens.OpenChangedFilesCommand]', ex);
            return window.showErrorMessage(`Unable to open changed files. See output channel for more details`);
        }
    }
}