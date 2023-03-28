const API_KEY = 'AIzaSyDJAzcShunUQyQf4ZLW1Kq2C1nmeRJ5Z7I';
const CLIENT_ID = '72414456133-2fcmuj1jss2hsribilgelto11g8nd3te.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

gapi.load('client:auth2', initClient);

let walletFolderId = null;

async function createFolderForWallet(walletAddress) {
  const folderName = `DecentralizedStorage_${walletAddress}`;
  const folderMetadata = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder'
  };

  try {
    const response = await gapi.client.drive.files.create({
      resource: folderMetadata,
      fields: 'id'
    });
    console.log(`Folder ID: ${response.result.id}`);
    return response.result.id;
  } catch (error) {
    console.error(`Error creating folder: ${error}`);
  }
}

async function uploadToGoogleDrive(file, folderId) {
  const metadata = {
    name: file.name,
    mimeType: file.type,
    parents: [folderId],
  };

  const accessToken = gapi.auth.getToken()?.access_token;
  if (!accessToken) {
    throw new Error('Access token is not available');
  }

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', file);

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
    body: form,
  });

  if (response.ok) {
    const data = await response.json();
    return data.id;
  } else {
    throw new Error('Failed to upload file to Google Drive');
  }
}



function initClient() {
  gapi.client
    .init({
      apiKey: API_KEY,
      clientId: CLIENT_ID,
      scope: SCOPES,
    })
    .then(async () => {
      googleApiInitialized = true;

      const walletConnected = localStorage.getItem('walletConnected') === 'true';
      if (walletConnected) {
        const walletAddress = await getWalletAddress();
        walletFolderId = await createFolderForWallet(walletAddress);
      }
    })
    .catch((error) => {
      console.error('Failed to initialize the Google API client:', error);
    });
}



if (typeof window.ethereum !== 'undefined' || typeof window.web3 !== 'undefined') {
  var web3 = new Web3(window.ethereum || window.web3.currentProvider);
} else {
  alert('Web3 not detected. Please install MetaMask or another Web3 wallet.');
}

async function enableWallet() {
  if (window.ethereum) {
    try {
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      localStorage.setItem('walletConnected', true);
      return true;
    } catch (error) {
      console.error('User denied wallet access:', error);
      return false;
    }
  } else {
    alert('Please install MetaMask or another Web3 wallet.');
    return false;
  }
}

async function disconnectWallet() {
  if (window.ethereum) {
    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (accounts.length > 0) {
        await window.ethereum.request({ method: 'wallet_removePermissions', params: [{ eth_accounts: {} }] });
        console.log('Wallet disconnected');
        localStorage.setItem('walletConnected', false);
      } else {
        console.error('No wallet connected to disconnect');
      }
    } catch (error) {
      console.error('Failed to disconnect wallet:', error);
    }
  }
}

function updateUI(walletConnected) {
  const connectWalletButton = document.getElementById('connect-wallet');
  const uploadButton = document.getElementById('upload-btn');
  if (walletConnected) {
    connectWalletButton.textContent = 'Disconnect Wallet';
    uploadButton.disabled = false;
  } else {
    connectWalletButton.textContent = 'Connect Wallet';
    uploadButton.disabled = true;
  }
}

document.getElementById('connect-wallet').addEventListener('click', async () => {
  const connectWalletButton = document.getElementById('connect-wallet');

  if (connectWalletButton.textContent === 'Connect Wallet') {
    const walletConnected = await enableWallet();
    if (walletConnected) {
      updateUI(true);
    }
  } else {
    await disconnectWallet();
    updateUI(false);
  }
});

async function listFilesInFolder(folderId) {
  try {
    const response = await gapi.client.drive.files.list({
      q: `'${folderId}' in parents`,
      fields: 'nextPageToken, files(id, name)',
      spaces: 'drive'
    });

    const files = response.result.files;

    if (files && files.length > 0) {
      console.log('Files:');
      for (const file of files) {
        console.log(`${file.name} (${file.id})`);
      }
    } else {
      console.log('No files found.');
    }
  } catch (error) {
    console.error(`Error listing files: ${error}`);
  }
}

document.getElementById('upload-form').addEventListener('submit', async (event) => {
  event.preventDefault();

  const connectWalletButton = document.getElementById('connect-wallet');
  const fileInput = document.getElementById('file-input');
  const files = fileInput.files;

  if (connectWalletButton.textContent !== 'Connect Wallet') {
    if (files.length === 0) {
      alert('Please choose at least one file to upload');
    } else {
      let emptyFile = false;
      let allFilesUploaded = true;

      for (let i = 0; i < files.length; i++) {
        if (files[i].size === 0) {
          emptyFile = true;
          break;
        }
      }

      if (emptyFile) {
        alert('Empty files cannot be uploaded');
      } else {
        // Process the file upload
        for (let i = 0; i < files.length; i++) {
          try {
            const fileId = await uploadToGoogleDrive(files[i], walletFolderId);
            console.log(`File uploaded to Google Drive with ID: ${fileId}`);
          } catch (error) {
            console.error(`Error uploading file ${files[i].name}:`, error);
            alert(`Error uploading file ${files[i].name}`);
            allFilesUploaded = false;
          }
        }
        if (allFilesUploaded) {
          alert('File upload(s) completed');
        }
      }
    }
  } else {
    alert('Connect the wallet first');
  }
});

// Check the wallet connection status on page load
document.addEventListener('DOMContentLoaded', () => {
  const walletConnected = localStorage.getItem('walletConnected') === 'true';
  updateUI(walletConnected);
});
