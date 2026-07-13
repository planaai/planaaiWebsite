@echo off
pushd "%~dp0backend"
node scripts\userole.js %*
popd
