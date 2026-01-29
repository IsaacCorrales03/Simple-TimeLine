const vscode = require('vscode');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

let timelinePanel = null;

function activate(context) {

	const snapshotCmd = vscode.commands.registerCommand(
		'cherrytimeline.createSnapshot',
		() => createSnapshot()
	);

	const timelineCmd = vscode.commands.registerCommand(
		"cherrytimeline.openTimeline",
		() => openTimeline(context)
	);

	context.subscriptions.push(snapshotCmd, timelineCmd);
}

async function createSnapshot() {
	const editor = vscode.window.activeTextEditor;
	if (!editor) return;

	const doc = editor.document;
	const content = doc.getText();
	const filename = vscode.workspace.asRelativePath(doc.uri.fsPath);
	const timestamp = Date.now();

	const name = await vscode.window.showInputBox({
		title: "Nombre del snapshot (opcional)"
	}) || "";

	const comment = await vscode.window.showInputBox({
		title: "Comentario (opcional)"
	}) || "";

	const hash = crypto
		.createHash('sha256')
		.update(content)
		.digest('hex');

	const snapshot = {
		timestamp,
		name,
		filename,
		hash,
		comment,
		snapshot_filePath: doc.uri.fsPath,
		content
	};

	const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
	const dirName = filename.replace(/\//g, "_");

	const dir = path.join(
		workspaceRoot,
		".vscode",
		"timeline",
		dirName
	);

	fs.mkdirSync(dir, { recursive: true });

	const filePath = path.join(dir, `snapshot-${timestamp}.json`);
	fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2));
}

async function openTimeline(context, forcedFilename = null) {
	let filename;

	if (forcedFilename) {
		filename = forcedFilename;
	} else {
		const editor = vscode.window.activeTextEditor;
		if (!editor) return;
		filename = vscode.workspace.asRelativePath(editor.document.uri.fsPath);
	}

	const dirName = filename.replace(/\//g, "_");
	const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;

	const dir = path.join(
		workspaceRoot,
		".vscode",
		"timeline",
		dirName
	);

	if (!fs.existsSync(dir)) {
		return;
	}

	const files = fs.readdirSync(dir)
		.filter(f => f.startsWith("snapshot-") && f.endsWith(".json"))
		.sort();

	const snapshots = files.map(f =>
		JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"))
	);

	if (timelinePanel) {
		timelinePanel.dispose();
	}

	timelinePanel = vscode.window.createWebviewPanel(
		"timelineView",
		"Timeline",
		vscode.ViewColumn.One,
		{ enableScripts: true, retainContextWhenHidden: true }
	);

	timelinePanel.webview.html = await getTimelineHTML(
		timelinePanel.webview,
		context.extensionUri,
		snapshots
	);

	timelinePanel.webview.onDidReceiveMessage(async (msg) => {

		if (msg.command === "restore") {
			await restoreSnapshot(msg.snapshot);
		}

		if (msg.command === "delete") {
			const file = msg.snapshot.filename;

			await deleteSnapshot(msg.snapshot);

			if (timelinePanel) {
				timelinePanel.dispose();
				timelinePanel = null;
			}

			await openTimeline(context, file);
		}
	});

	timelinePanel.onDidDispose(() => {
		timelinePanel = null;
	});
}

async function restoreSnapshot(snapshot) {
	const fileUri = vscode.Uri.file(snapshot.snapshot_filePath);

	const document = await vscode.workspace.openTextDocument(fileUri);
	const editor = await vscode.window.showTextDocument(document, { preview: false });

	const fullRange = new vscode.Range(
		document.positionAt(0),
		document.positionAt(document.getText().length)
	);

	await editor.edit(editBuilder => {
		editBuilder.replace(fullRange, snapshot.content);
	});

	await document.save();
}

function getTimelineHTML(webview, extensionUri, snapshots) {
	const htmlPath = vscode.Uri.joinPath(extensionUri, "media", "timeline.html").fsPath;
	let html = fs.readFileSync(htmlPath, "utf8");

	const cssUrl = webview.asWebviewUri(
		vscode.Uri.joinPath(extensionUri, "media", "timeline.css")
	);

	const jsUrl = webview.asWebviewUri(
		vscode.Uri.joinPath(extensionUri, "media", "timeline.js")
	);

	const nodesHtml = snapshots.map(s => {
		const label = s.name?.trim()
			? s.name
			: new Date(s.timestamp).toLocaleString();

		return `
<div class="node branch-0" data-id="${s.timestamp}">
	<div class="line-node-row">
		<div class="line left"></div>
		<div class="dot"></div>
		<div class="line right"></div>
	</div>
	<div class="label">${label}</div>
</div>`;
	}).join("");

	html = html
		.replace("{{css}}", cssUrl)
		.replace("{{js}}", jsUrl)
		.replace("{{nodes}}", nodesHtml)
		.replace(
			"{{snapshots_json}}",
			JSON.stringify(snapshots).replace(/</g, "\\u003c")
		);

	return html;
}

async function deleteSnapshot(snapshot) {
	const ts = snapshot.timestamp;
	const filename = snapshot.filename.replace(/\//g, "_");

	const workspace = vscode.workspace.workspaceFolders[0].uri.fsPath;

	const folder = path.join(
		workspace,
		".vscode",
		"timeline",
		filename
	);

	const filePath = path.join(folder, `snapshot-${ts}.json`);

	if (fs.existsSync(filePath)) {
		fs.unlinkSync(filePath);
	}
}

function deactivate() {
	if (timelinePanel) {
		timelinePanel.dispose();
	}
}

module.exports = {
	activate,
	deactivate
};
