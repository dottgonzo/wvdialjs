#! /bin/bash



target='/etc/wvdial.conf'






while getopts c:a:p:n:u:t:y option
	do
		case $option
		in
		        t) todo=$OPTARG;;
			c) target=$OPTARG;;
      d) tty=$OPTARG;;
		        a) apn=$OPTARG;;
		        p) passw=$OPTARG;;
		        n) number=$OPTARG;;
		        u) user=$OPTARG;;
y) force='y';;

		esac
	done









#target="example_wpa/wpa"




# add, list, remove, priority



if [[ $(ls /dev/ | grep -v 'grep' | grep -c 'ttyA') > 0 ]]; then
dev='true'
else

dev='false'

fi
if [[ $todo == 'get' ]] && [[ -f $target ]];then

number=$(cat $target | grep 'Phone'|sed 's/Phone=//g')
tty=$(cat $target | grep 'Modem'|sed 's/Modem=//g')
username=$(cat $target | grep 'Username'|sed 's/Username=//g')
password=$(cat $target | grep 'Password'|sed 's/Password=//g')
apn=$(cat $target | grep 'Apn'|sed 's/Apn=//g')

echo -n "{\"number\":\"$number\",\"username\":\"$username\",\"password\":\"$password\",\"apn\":\"$apn\",\"tty\":\"$tty\"}"

fi


if [[ $apn ]] && [[ -f $target ]] && [[ $(printf "$apn" | wc -c) -gt 3 ]] && [[ $(echo "$apn"|grep -v 'grep'|grep -c '.') > 0 ]] && [[ $todo == 'set' ]]; then



if [[ ! $force ]]; then

echo "Are you sure?"
read sure

	if [[ $sure != 'y' ]]; then

	exit

	fi

fi








echo '[Dialer Defaults]' > $target
echo 'Init3 = AT+CGDCONT=1,"ip","'"$apn"'",,0,0' >> $target

if [[ "$number" ]];then
echo "Phone = $number" >> $target
else
echo 'Phone = *99#' >> $target
fi
if [[ "$tty" ]];then
echo "Modem = $tty" >> $target
fi
if [[ "$username" ]];then
echo "Username = $username" >> $target
else
echo 'Username = none' >> $target
fi

if [[ "$passw" ]];then
echo "Password = $passw" >> $target
else
echo "Password = none" >> $target
fi

echo -n '{"apn":"'"$apn"'","phone":"'"$phone"'","user":"'"$username"'","password":"'"$passw"'","plugged":"'$dev'"}'


elif [[ $todo == 'device' ]] && [[ -f $target ]]; then




echo -n '{"plugged":"'$dev'"}'





else


echo -n '{"error":"no wvdial.conf founded, or wrong apn","device":"'$dev'"}'

fi
